import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import dotenv from 'dotenv';
dotenv.config();

const router = Router();

// ============================================================
// SECURITY: Enforce strong secrets — refuse to start with defaults
// ============================================================
// The comment above was already the intent, but the old check only ever
// logged a warning — and its own hardcoded fallback value (64 hex chars)
// was long enough to silently pass the length check, so the warning could
// never actually fire for the one case it existed to catch. This now
// genuinely refuses to start rather than run on a known, previously-leaked
// value. Production supplies both via a Kubernetes Secret; local dev via .env.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET environment variable is missing or too short (must be at least 32 characters). Refusing to start.');
}
if (!process.env.REFRESH_SECRET || process.env.REFRESH_SECRET.length < 32) {
  throw new Error('REFRESH_SECRET environment variable is missing or too short (must be at least 32 characters). Refusing to start.');
}

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

// DEMO_MODE exposes a "log in as any active user, no password" endpoint used by the
// demo login-page user switcher. Never enable this against a real customer dataset.
// SECURITY: hard-gated on more than the env flag alone — a security audit
// confirmed that with DEMO_MODE=true alone, GET /demo/users is a fully
// unauthenticated public listing of every active user (id, name, email,
// role), and POST /demo/login with any of those ids returns a full session
// with zero password check, including for admin accounts. A leftover or
// accidentally-copied DEMO_MODE=true in the real deployment would be a
// complete authentication bypass.
//
// NODE_ENV is NOT usable as the second signal here: npm start (package.json)
// hardcodes NODE_ENV=production unconditionally — including for local/sandbox
// runs — so checking it would disable demo mode for every legitimate local
// use, not just real production. FRONTEND_URL is the reliable signal instead:
// the real deployment always sets it to the production hostname (previously
// hardcoded here to the AWS-era domain, k3s/app-deployment.yaml; now driven
// by an explicit PRODUCTION_FRONTEND_URL env var so it survives moving
// hostnames — e.g. the on-prem migration's charts/rmt sets both FRONTEND_URL
// and PRODUCTION_FRONTEND_URL to the same on-prem hostname, keeping this
// check meaningful instead of silently becoming a no-op against a domain
// that no longer matches anything), while every local/sandbox .env leaves
// PRODUCTION_FRONTEND_URL unset (or pointing elsewhere) and so never matches.
const PRODUCTION_FRONTEND_URL = process.env.PRODUCTION_FRONTEND_URL || 'https://rmt.marslabintel.com';
const DEMO_MODE = process.env.DEMO_MODE === 'true' && process.env.FRONTEND_URL !== PRODUCTION_FRONTEND_URL;

// ==========================================
// REFRESH TOKEN HELPERS
// ==========================================

/**
 * Creates a signed refresh JWT, stores its SHA-256 hash in the DB.
 * Refresh tokens never expire (exp: 99 years) — only DB revocation applies.
 */
async function issueRefreshToken(userId) {
  // Generate a unique refresh token (signed JWT containing userId + random jti)
  const jti = crypto.randomBytes(32).toString('hex');
  const refreshToken = jwt.sign(
    { id: userId, jti },
    REFRESH_SECRET,
    { expiresIn: '10y' } // effectively permanent — revoked via DB
  );

  // Store SHA-256 hash (never store raw tokens in DB)
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  // Set expires_at to 10 years from now
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 10);

  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );

  return refreshToken;
}

/**
 * Sets the refresh token as an HttpOnly, Secure, SameSite=Strict cookie.
 */
function setRefreshCookie(res, refreshToken) {
  res.cookie('rmt_refresh_token', refreshToken, {
    httpOnly: true,          // Not accessible by JavaScript
    secure: process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL?.startsWith('https'), // HTTPS only if production domain is https
    sameSite: 'lax',         // Allow top-level navigation within the app
    maxAge: 10 * 365 * 24 * 60 * 60 * 1000, // 10 years in ms
    path: '/api/auth',       // Only sent to auth endpoints
  });
}

// ==========================================
// STANDARD USERNAME / PASSWORD LOGIN
// ==========================================

// Looks up the human-readable department/category names for a user's scope
// claims — used only for display (the "Viewing: Software → AWS" badge), the
// JWT/req.user still carries the ids, never these names, for scoping checks.
async function fetchScopeNames(departmentId, categoryId) {
  const [deptRes, catRes] = await Promise.all([
    departmentId ? db.query('SELECT name FROM departments WHERE id = $1', [departmentId]) : Promise.resolve({ rows: [] }),
    categoryId ? db.query('SELECT name FROM categories WHERE id = $1', [categoryId]) : Promise.resolve({ rows: [] }),
  ]);
  return {
    departmentName: deptRes.rows[0]?.name ?? null,
    categoryName: catRes.rows[0]?.name ?? null,
  };
}

function issueSession(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.full_name,
      email: user.email,
      // RBAC v2: null for super_admin, department_id set for dept_admin,
      // both set for user. Carried in the JWT so every request has scope
      // without a DB round-trip; re-derived fresh from the DB on every
      // /refresh below (not copied from the old token) so a department/
      // category reassignment takes effect on next silent refresh rather
      // than requiring a full re-login — same bounded-staleness tradeoff
      // this app already accepts for role changes.
      departmentId: user.department_id ?? null,
      categoryId: user.category_id ?? null,
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

// POST /api/auth/login  { email, password }
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [String(email).toLowerCase().trim()]);
    const user = rows[0];

    // SECURITY: run bcrypt.compare even when the user doesn't exist, against a
    // dummy hash, so failed lookups take the same time as a wrong-password
    // failure and don't leak which emails are registered via response timing.
    const hashToCompare = user ? user.password : '$2a$10$C6UzMDM.H6dfI/f/IKcEeOxsHqrTQMkQhbeQiTLwj7WdU1XTNjSyi';
    const passwordMatches = await bcrypt.compare(password, hashToCompare);

    if (!user || !passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Your account has been deactivated. Please contact administrator.' });
    }

    const accessToken = issueSession(user);
    const refreshToken = await issueRefreshToken(user.id);

    await db.query(`
      INSERT INTO activity_logs (user_id, action, entity_type, details)
      VALUES ($1, 'login', 'user', $2)
    `, [user.id, `${user.full_name} logged in.`]);

    setRefreshCookie(res, refreshToken);

    const scopeNames = await fetchScopeNames(user.department_id, user.category_id);
    res.json({
      token: accessToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        departmentId: user.department_id ?? null,
        categoryId: user.category_id ?? null,
        departmentName: scopeNames.departmentName,
        categoryName: scopeNames.categoryName,
        avatarColor: user.avatar_color,
      },
    });
  } catch (err) {
    console.error('[login error]', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ==========================================
// DEMO MODE: list users / switch user, no password
// Only mounted when DEMO_MODE=true — lets a client demo instantly switch
// between roles from the login page to explore the app. Never enable this
// against a real customer dataset.
// ==========================================

if (DEMO_MODE) {
  console.log('⚠️  DEMO_MODE is enabled — passwordless user switching is active on /api/auth/demo/*');

  // GET /api/auth/demo/users — public list of active users to show as "switch user" cards
  router.get('/demo/users', async (req, res) => {
    try {
      const { rows } = await db.query(
        `SELECT u.id, u.full_name, u.email, u.role, u.avatar_color,
                d.name as department_name, c.name as category_name
         FROM users u
         LEFT JOIN departments d ON u.department_id = d.id
         LEFT JOIN categories c ON u.category_id = c.id
         WHERE u.is_active = TRUE
         ORDER BY 
           CASE 
             WHEN u.role = 'ceo' THEN 0 
             WHEN u.role = 'super_admin' THEN 1 
             WHEN u.role = 'dept_admin' THEN 2 
             ELSE 3 
           END, 
           u.full_name`
      );
      res.json(rows);
    } catch (err) {
      console.error('[demo/users error]', err.message);
      res.status(500).json({ error: 'Internal server error.' });
    }
  });

  // POST /api/auth/demo/login  { userId } — logs in as the given user, no password
  router.post('/demo/login', async (req, res) => {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId is required.' });

    try {
      const { rows } = await db.query('SELECT * FROM users WHERE id = $1 AND is_active = TRUE', [userId]);
      const user = rows[0];
      if (!user) return res.status(404).json({ error: 'User not found or inactive.' });

      const accessToken = issueSession(user);
      const refreshToken = await issueRefreshToken(user.id);

      await db.query(`
        INSERT INTO activity_logs (user_id, action, entity_type, details)
        VALUES ($1, 'login', 'user', $2)
      `, [user.id, `${user.full_name} logged in via demo user switcher.`]);

      setRefreshCookie(res, refreshToken);

      const scopeNames = await fetchScopeNames(user.department_id, user.category_id);
      res.json({
        token: accessToken,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          email: user.email,
          role: user.role,
          departmentId: user.department_id ?? null,
          categoryId: user.category_id ?? null,
          departmentName: scopeNames.departmentName,
          categoryName: scopeNames.categoryName,
          avatarColor: user.avatar_color,
        },
      });
    } catch (err) {
      console.error('[demo/login error]', err.message);
      res.status(500).json({ error: 'Internal server error.' });
    }
  });
}

// ==========================================
// REFRESH TOKEN ENDPOINT
// ==========================================

/**
 * POST /api/auth/refresh
 * Uses the HttpOnly cookie to issue a new access token + rotate the refresh token.
 */
router.post('/refresh', async (req, res) => {
  const incomingRefreshToken = req.cookies?.rmt_refresh_token;

  if (!incomingRefreshToken) {
    return res.status(401).json({ error: 'No refresh token provided.' });
  }

  try {
    // Verify the refresh token signature
    const decoded = jwt.verify(incomingRefreshToken, REFRESH_SECRET);

    // Check if the token hash exists and is not revoked in DB
    const tokenHash = crypto.createHash('sha256').update(incomingRefreshToken).digest('hex');
    const { rows } = await db.query(
      `SELECT * FROM refresh_tokens WHERE token_hash = $1 AND revoked = 0 AND expires_at > NOW()`,
      [tokenHash]
    );

    if (rows.length === 0) {
      // Token reuse detected or already revoked — clear cookie
      res.clearCookie('rmt_refresh_token', { path: '/api/auth' });
      return res.status(401).json({ error: 'Refresh token is invalid or has been revoked.' });
    }
    // Fetch latest user data from DB
    const { rows: userRows } = await db.query('SELECT * FROM users WHERE id = $1', [decoded.id]);
    const user = userRows[0];
    if (!user) {
      res.clearCookie('rmt_refresh_token', { path: '/api/auth' });
      return res.status(401).json({ error: 'User not found.' });
    }

    if (!user.is_active) {
      res.clearCookie('rmt_refresh_token', { path: '/api/auth' });
      return res.status(401).json({ error: 'User account is deactivated.' });
    }

    // ROTATION: Revoke the old refresh token
    await db.query(
      `UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = $1`,
      [tokenHash]
    );

    // Issue a new access token
    const newAccessToken = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        departmentId: user.department_id ?? null,
        categoryId: user.category_id ?? null,
        fullName: user.full_name,
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Issue a new refresh token (rotation)
    const newRefreshToken = await issueRefreshToken(user.id);
    setRefreshCookie(res, newRefreshToken);

    console.log(`🔄 Token refreshed for user: ${user.email}`);

    const scopeNames = await fetchScopeNames(user.department_id, user.category_id);
    return res.json({
      token: newAccessToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        departmentId: user.department_id ?? null,
        categoryId: user.category_id ?? null,
        departmentName: scopeNames.departmentName,
        categoryName: scopeNames.categoryName,
        avatarColor: user.avatar_color,
      },
    });
  } catch (err) {
    console.error('[Refresh Token Error]:', err.message);
    res.clearCookie('rmt_refresh_token', { path: '/api/auth' });
    return res.status(401).json({ error: 'Refresh token is invalid or expired.' });
  }
});

// ==========================================
// LOGOUT ENDPOINT
// ==========================================

/**
 * POST /api/auth/logout
 * Revokes the refresh token in DB and clears the cookie.
 */
router.post('/logout', async (req, res) => {
  const incomingRefreshToken = req.cookies?.rmt_refresh_token;

  if (incomingRefreshToken) {
    try {
      const tokenHash = crypto.createHash('sha256').update(incomingRefreshToken).digest('hex');
      await db.query(`UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = $1`, [tokenHash]);
      console.log('🔐 Refresh token revoked on logout.');
    } catch (err) {
      console.error('[Logout revocation error]:', err.message);
    }
  }

  res.clearCookie('rmt_refresh_token', { path: '/api/auth' });
  return res.json({ message: 'Logged out successfully.' });
});

// ==========================================
// STANDARD AUTH ROUTES
// ==========================================

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, username, email, full_name, role, avatar_color, department_id, category_id FROM users WHERE id = $1', [req.user.id]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const scopeNames = await fetchScopeNames(user.department_id, user.category_id);
    res.json({
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      departmentId: user.department_id ?? null,
      categoryId: user.category_id ?? null,
      departmentName: scopeNames.departmentName,
      categoryName: scopeNames.categoryName,
      avatarColor: user.avatar_color,
    });
  } catch(err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Change password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // SECURITY: Validate new password strength
    if (!newPassword || newPassword.length < 10) {
      return res.status(400).json({ error: 'New password must be at least 10 characters.' });
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return res.status(400).json({ error: 'New password must contain uppercase, lowercase, and a number.' });
    }

    const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = rows[0];

    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (!await bcrypt.compare(currentPassword, user.password)) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    // SECURITY: Prevent reuse of current password
    if (await bcrypt.compare(newPassword, user.password)) {
      return res.status(400).json({ error: 'New password must be different from your current password.' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hash, req.user.id]);

    await db.query(`
      INSERT INTO activity_logs (user_id, action, entity_type, details)
      VALUES ($1, 'password_change', 'user', 'Password changed successfully.')
    `, [req.user.id]);

    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('[change-password error]', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
