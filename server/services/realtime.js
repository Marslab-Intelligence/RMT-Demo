import jwt from 'jsonwebtoken';
import db from '../db.js';
import { isRecordVisibleToUser } from '../utils/scope.js';

// SECURITY: no fallback secret here. The previous hardcoded fallback
// ('b6e8a49f...') was a real secret committed to source — harmless only
// because middleware/auth.js already refuses to boot the process when
// JWT_SECRET is unset, but a landmine regardless (this module works standalone
// or could be imported before that guard runs in some future refactor). If
// JWT_SECRET is somehow unset here, jwt.verify below throws and every
// connection is correctly rejected — failing closed, not open.
const JWT_SECRET = process.env.JWT_SECRET;

let clients = [];

export const registerClient = async (req, res) => {
  const token = req.query.token;
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Missing token' });
    return;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
    return;
  }

  // SECURITY: authenticateToken (middleware/auth.js) re-checks is_active on
  // every request so a deactivated account's session dies immediately; this
  // endpoint bypassed that (a deactivated employee's still-valid access token
  // kept streaming live renewal data — client names, values, invoices — for
  // up to its full 8h lifetime). Same check, applied here too.
  try {
    const { rows } = await db.query('SELECT is_active FROM users WHERE id = $1', [decoded.id]);
    if (rows.length === 0 || !rows[0].is_active) {
      res.status(403).json({ error: 'Account is deactivated.' });
      return;
    }
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
    return;
  }

  // Set headers for Server-Sent Events (SSE). Deliberately NOT setting
  // Access-Control-Allow-Origin here — that overrode the app's real,
  // origin-validated CORS header (set earlier by the cors() middleware in
  // server/index.js) with a wildcard, letting any website embed
  // `new EventSource(.../events?token=...)` and read the stream cross-origin
  // if a token ever reached it through any other channel. Omitting it here
  // leaves the already-correct header from the global CORS policy in place.
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Write initial connection message
  res.write('data: {"type":"connected"}\n\n');
  if (typeof res.flush === 'function') res.flush();

  // Clean up on client disconnection
  let isCleanedUp = false;
  const cleanup = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    clearInterval(keepAliveInterval);
    clients = clients.filter(c => c.id !== clientObj.id);
    console.log(`🔌 Real-Time Client disconnected. Total active clients: ${clients.length}`);
  };

  req.on('close', cleanup);
  req.on('end', cleanup);
  req.on('error', (err) => {
    console.warn('SSE req error:', err.message);
    cleanup();
  });
  res.on('error', (err) => {
    console.warn('SSE res error:', err.message);
    cleanup();
  });
  res.on('close', cleanup);
  res.on('finish', cleanup);

  // Keep HTTP/2 & proxy connections alive with comments + ping every 15 seconds
  const keepAliveInterval = setInterval(() => {
    try {
      if (res.writableEnded || res.destroyed) {
        cleanup();
        return;
      }
      res.write(': keep-alive\n\n');
      res.write('data: {"type":"ping"}\n\n');
      if (typeof res.flush === 'function') res.flush();
    } catch (err) {
      cleanup();
    }
  }, 15000);

  const clientObj = {
    id: Date.now() + Math.random(),
    res,
    user: {
      role: decoded.role,
      departmentId: decoded.departmentId,
      categoryId: decoded.categoryId,
      fullName: decoded.fullName,
      email: decoded.email,
    },
  };
  clients.push(clientObj);

  console.log(`🔌 Real-Time Client connected. Total active clients: ${clients.length}`);
};

// `data` is only scoping-sensitive when it looks like a renewal row (carries
// department_id/category_id) — other event shapes (visit tracking, agent job
// status) pass through unfiltered, same as before.
const isRenewalShaped = (data) =>
  data && typeof data === 'object' && ('department_id' in data || 'category_id' in data);

export const broadcastEvent = (type, data) => {
  console.log(`📡 Real-Time Broadcasting event: ${type}`);
  const scoped = isRenewalShaped(data);
  const fullPayload = JSON.stringify({ type, data });
  const strippedPayload = JSON.stringify({ type, data: null });

  // Clean up any stale clients before broadcasting
  clients = clients.filter(client => !client.res.writableEnded && !client.res.destroyed);

  clients.forEach(client => {
    try {
      if (client.res.writableEnded || client.res.destroyed) return;
      const visible = !scoped || isRecordVisibleToUser(data, client.user);
      client.res.write(`data: ${visible ? fullPayload : strippedPayload}\n\n`);
      if (typeof client.res.flush === 'function') client.res.flush();
    } catch (err) {
      console.warn('Error writing to client:', err.message);
    }
  });
};

