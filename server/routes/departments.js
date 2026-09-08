import { Router } from 'express';
import db from '../db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { computeUserPerformance } from '../utils/userMetrics.js';

const router = Router();

function slugify(name) {
  return String(name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// A dept_admin or user may only ever access their own department; super_admin is
// unrestricted. Used by /services and department routes.
function assertDeptAccess(req, res, departmentId) {
  if (req.user.role === 'super_admin') return true;
  if ((req.user.role === 'dept_admin' || req.user.role === 'user') && req.user.departmentId === departmentId) return true;
  res.status(403).json({ error: 'You do not have access to this department.' });
  return false;
}

// GET /api/departments — super_admin sees all, dept_admin and user see only their own.
router.get('/', authenticateToken, requireRole('super_admin', 'dept_admin', 'user'), async (req, res) => {
  try {
    const params = [];
    let whereClause = '';
    if (req.user.role === 'dept_admin' || req.user.role === 'user') {
      params.push(req.user.departmentId);
      whereClause = 'WHERE d.id = $1';
    }
    // Rollup KPIs per department (Analytics: revenue/profit/overdue/
    // conversion) — same "overdue" and "conversion rate" definitions used
    // on the main dashboard (server/routes/dashboard.js /stats), computed
    // here scoped to department_id via a correlated subquery so the count
    // of departments returned stays small (a handful, not hundreds) and
    // this doesn't need the CTE treatment computeUserPerformance uses.
    const { rows } = await db.query(`
      SELECT d.id, d.name, d.slug, d.is_active, d.created_at,
        (SELECT COUNT(*) FROM categories c WHERE c.department_id = d.id AND c.is_active = TRUE) as service_count,
        (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id) as user_count,
        (SELECT COALESCE(SUM(r.value), 0) FROM renewals r WHERE r.department_id = d.id AND r.is_deleted = false) as revenue,
        (SELECT COALESCE(SUM(r.profit), 0) FROM renewals r WHERE r.department_id = d.id AND r.is_deleted = false) as profit,
        (SELECT COUNT(*) FROM renewals r WHERE r.department_id = d.id AND r.is_deleted = false AND r.status IN ('Active', 'Pending Renewal')) as active_count,
        (SELECT COUNT(*) FROM renewals r WHERE r.department_id = d.id AND r.is_deleted = false
           AND (r.renewal_date < CURRENT_DATE OR r.status = 'Expired') AND r.status != 'Renewed'
           AND (r.renewal_confirmation IS NULL OR r.renewal_confirmation != 'renewed')) as overdue_count,
        (SELECT COUNT(*) FROM renewals r WHERE r.department_id = d.id AND r.is_deleted = false
           AND (r.status = 'Renewed' OR r.renewal_confirmation = 'renewed')) as renewed_count,
        (SELECT COUNT(*) FROM renewals r WHERE r.department_id = d.id AND r.is_deleted = false AND r.status = 'Expired') as expired_count
      FROM departments d
      ${whereClause}
      ORDER BY d.name ASC
    `, params);

    res.json(rows.map((d) => {
      const renewedCount = parseInt(d.renewed_count, 10);
      const expiredCount = parseInt(d.expired_count, 10);
      const finished = renewedCount + expiredCount;
      const revenue = parseFloat(d.revenue);
      const profit = parseFloat(d.profit);
      return {
        id: d.id,
        name: d.name,
        slug: d.slug,
        is_active: d.is_active,
        created_at: d.created_at,
        service_count: d.service_count,
        user_count: d.user_count,
        revenue,
        profit,
        marginPct: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0,
        activeCount: parseInt(d.active_count, 10),
        overdueCount: parseInt(d.overdue_count, 10),
        conversionRatePct: finished > 0 ? Math.round((renewedCount / finished) * 1000) / 10 : 0,
      };
    }));
  } catch (err) {
    console.error('[Departments GET]', err);
    res.status(500).json({ error: 'Failed to fetch departments.' });
  }
});

// POST /api/departments — super_admin only.
router.post('/', authenticateToken, requireRole('super_admin'), async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Department name is required.' });
  }
  const slug = slugify(name);
  if (!slug) {
    return res.status(400).json({ error: 'Department name must contain at least one alphanumeric character.' });
  }
  try {
    const { rows } = await db.query(
      `INSERT INTO departments (name, slug, created_by) VALUES ($1, $2, $3) RETURNING id, name, slug, is_active, created_at`,
      [name.trim(), slug, req.user.id]
    );
    await db.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details) VALUES ($1, 'create', 'department', $2, $3)`,
      [req.user.id, String(rows[0].id), `Created department: ${rows[0].name}`]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A department with this name already exists.' });
    }
    console.error('[Departments POST]', err);
    res.status(500).json({ error: 'Failed to create department.' });
  }
});

// PATCH /api/departments/:id — super_admin only. Renames or (de)activates.
// Deactivation is blocked while any active, non-expired renewal still
// references the department, per the explicit policy documented in the plan.
router.patch('/:id', authenticateToken, requireRole('super_admin'), async (req, res) => {
  const departmentId = parseInt(req.params.id, 10);
  const { name, is_active } = req.body;
  try {
    const { rows: existing } = await db.query('SELECT * FROM departments WHERE id = $1', [departmentId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Department not found.' });

    if (is_active === false && existing[0].is_active) {
      const { rows: blocking } = await db.query(
        `SELECT COUNT(*) as count FROM renewals WHERE department_id = $1 AND is_deleted = FALSE AND status != 'Expired'`,
        [departmentId]
      );
      const count = parseInt(blocking[0].count, 10);
      if (count > 0) {
        return res.status(400).json({ error: `Cannot deactivate: ${count} active, non-expired renewal(s) still reference this department.` });
      }
    }

    const fields = [];
    const params = [];
    if (typeof name === 'string' && name.trim()) {
      params.push(name.trim());
      fields.push(`name = $${params.length}`);
      params.push(slugify(name));
      fields.push(`slug = $${params.length}`);
    }
    if (typeof is_active === 'boolean') {
      params.push(is_active);
      fields.push(`is_active = $${params.length}`);
    }
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update.' });
    }
    params.push(departmentId);
    const { rows } = await db.query(
      `UPDATE departments SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING id, name, slug, is_active, created_at`,
      params
    );

    await db.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details) VALUES ($1, 'update', 'department', $2, $3)`,
      [req.user.id, String(departmentId), `Updated department: ${rows[0].name}`]
    );

    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A department with this name already exists.' });
    }
    console.error('[Departments PATCH]', err);
    res.status(500).json({ error: 'Failed to update department.' });
  }
});

// GET /api/departments/:id — full department detail: service breakdown
// (revenue/profit/margin/conversion per service), pipeline funnel (status
// counts), monthly profit trend, and a summary of user traffic-light
// standing. super_admin or the department's own dept_admin/user only —
// financial detail (purchase cost) is included for dept_admin too, per
// policy: dept_admin sees full financial detail for their own department.
router.get('/:id', authenticateToken, requireRole('super_admin', 'dept_admin', 'user'), async (req, res) => {
  const departmentId = parseInt(req.params.id, 10);
  if (!assertDeptAccess(req, res, departmentId)) return;
  try {
    const { rows: deptRows } = await db.query('SELECT * FROM departments WHERE id = $1', [departmentId]);
    if (deptRows.length === 0) return res.status(404).json({ error: 'Department not found.' });

    const [serviceRows, pipelineRows, trendRows, userPerf, responseTimeRows, serviceMixRows, activityTrendRows] = await Promise.all([
      // Service breakdown — revenue, profit, margin %, and conversion rate
      // per normalized service (category), ranked by margin so a high-
      // volume/low-margin service doesn't look artificially "better" than a
      // low-volume/high-margin one.
      db.query(`
        SELECT c.id, c.name, c.is_active,
          COUNT(r.id)::int as renewal_count,
          COALESCE(SUM(r.value), 0)::float as revenue,
          COALESCE(SUM(r.purchase_cost), 0)::float as purchase_cost,
          COALESCE(SUM(r.profit), 0)::float as profit,
          COUNT(*) FILTER (WHERE r.status = 'Renewed' OR r.renewal_confirmation = 'renewed')::int as renewed_count,
          COUNT(*) FILTER (WHERE r.status = 'Expired')::int as expired_count
        FROM categories c
        LEFT JOIN renewals r ON r.category_id = c.id AND r.is_deleted = false
        WHERE c.department_id = $1
        GROUP BY c.id, c.name, c.is_active
        ORDER BY c.name ASC
      `, [departmentId]),
      // Pipeline funnel — renewal_confirmation stage counts, turning that
      // status column into an actual funnel.
      db.query(`
        SELECT COALESCE(renewal_confirmation, 'pending') as stage, COUNT(*)::int as count
        FROM renewals
        WHERE department_id = $1 AND is_deleted = false
        GROUP BY stage
      `, [departmentId]),
      // Monthly profit trend for this department only.
      db.query(`
        SELECT to_char(renewal_date, 'YYYY-MM') as month,
          COALESCE(SUM(value), 0)::float as revenue,
          COALESCE(SUM(profit), 0)::float as profit
        FROM renewals
        WHERE department_id = $1 AND is_deleted = false AND renewal_date IS NOT NULL
          AND renewal_date <= (CURRENT_DATE + INTERVAL '12 months')::date
        GROUP BY month
        ORDER BY month ASC
        LIMIT 16
      `, [departmentId]),
      computeUserPerformance(departmentId),
      // Response-time distribution — how long after a renewal enters the
      // queue does the first logged action happen, bucketed so one outlier
      // (a renewal untouched for 60 days) doesn't hide inside an average.
      // Same >= guard as computeUserPerformance for backfilled/imported
      // history whose timestamps can predate created_at.
      db.query(`
        WITH first_action AS (
          SELECT r.id, r.created_at, MIN(rh.performed_at) as first_action_at
          FROM renewals r
          JOIN renewal_history rh ON rh.renewal_id = r.id
          WHERE r.department_id = $1 AND r.is_deleted = false
          GROUP BY r.id, r.created_at
          HAVING MIN(rh.performed_at) >= r.created_at
        )
        SELECT
          COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (first_action_at - created_at)) / 86400 < 1) as same_day,
          COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (first_action_at - created_at)) / 86400 >= 1 AND EXTRACT(EPOCH FROM (first_action_at - created_at)) / 86400 < 4) as d1_3,
          COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (first_action_at - created_at)) / 86400 >= 4 AND EXTRACT(EPOCH FROM (first_action_at - created_at)) / 86400 < 8) as d4_7,
          COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (first_action_at - created_at)) / 86400 >= 8 AND EXTRACT(EPOCH FROM (first_action_at - created_at)) / 86400 < 15) as d8_14,
          COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (first_action_at - created_at)) / 86400 >= 15) as d15_plus,
          (SELECT COUNT(*) FROM renewals r2 WHERE r2.department_id = $1 AND r2.is_deleted = false
             AND NOT EXISTS (SELECT 1 FROM renewal_history rh2 WHERE rh2.renewal_id = r2.id)) as never_touched
        FROM first_action
      `, [departmentId]),
      // Service mix per rep — which reps are working which services, useful
      // for telling a skill issue apart from "handed the worst-margin
      // service line".
      db.query(`
        SELECT u.id as user_id, u.full_name, c.name as service_name, COUNT(r.id)::int as renewal_count
        FROM users u
        JOIN renewals r ON (LOWER(r.owner) = LOWER(u.full_name) OR LOWER(r.sales_email) = LOWER(u.email))
        LEFT JOIN categories c ON c.id = r.category_id
        WHERE u.department_id = $1 AND u.role = 'user' AND r.department_id = $1 AND r.is_deleted = false
        GROUP BY u.id, u.full_name, c.name
        ORDER BY u.full_name ASC, renewal_count DESC
      `, [departmentId]),
      // Weekly activity volume for the last 8 weeks — a simple "are we
      // improving" trend derived from renewal_history, independent of
      // revenue timing (revenue/profit trend already exists above).
      db.query(`
        SELECT to_char(date_trunc('week', rh.performed_at), 'YYYY-MM-DD') as week_start, COUNT(*)::int as action_count
        FROM renewal_history rh
        JOIN renewals r ON r.id = rh.renewal_id
        WHERE r.department_id = $1
          AND rh.performed_at >= (CURRENT_DATE - INTERVAL '8 weeks')
        GROUP BY week_start
        ORDER BY week_start ASC
      `, [departmentId]),
    ]);

    const services = serviceRows.rows.map((s) => {
      const finished = s.renewed_count + s.expired_count;
      return {
        id: s.id,
        name: s.name,
        isActive: s.is_active,
        renewalCount: s.renewal_count,
        revenue: s.revenue,
        purchaseCost: s.purchase_cost,
        profit: s.profit,
        marginPct: s.revenue > 0 ? Math.round((s.profit / s.revenue) * 1000) / 10 : 0,
        conversionRatePct: finished > 0 ? Math.round((s.renewed_count / finished) * 1000) / 10 : 0,
      };
    }).sort((a, b) => b.marginPct - a.marginPct);

    const rt = responseTimeRows.rows[0] || {};
    const responseTimeDistribution = [
      { label: 'Same day', count: parseInt(rt.same_day || 0, 10) },
      { label: '1-3 days', count: parseInt(rt.d1_3 || 0, 10) },
      { label: '4-7 days', count: parseInt(rt.d4_7 || 0, 10) },
      { label: '8-14 days', count: parseInt(rt.d8_14 || 0, 10) },
      { label: '15+ days', count: parseInt(rt.d15_plus || 0, 10) },
      { label: 'Never touched', count: parseInt(rt.never_touched || 0, 10) },
    ];

    // Group flat (user, service, count) rows into one row per rep with a
    // services array — easier for the frontend to render as a small table.
    const serviceMixByUser = new Map();
    for (const row of serviceMixRows.rows) {
      if (!serviceMixByUser.has(row.user_id)) {
        serviceMixByUser.set(row.user_id, { userId: row.user_id, fullName: row.full_name, services: [] });
      }
      if (row.service_name) {
        serviceMixByUser.get(row.user_id).services.push({ name: row.service_name, count: row.renewal_count });
      }
    }

    res.json({
      department: deptRows[0],
      services,
      pipeline: pipelineRows.rows,
      monthlyTrend: trendRows.rows,
      activityTrend: activityTrendRows.rows,
      responseTimeDistribution,
      serviceMix: Array.from(serviceMixByUser.values()),
      users: userPerf,
      userSummary: {
        total: userPerf.length,
        stalled: userPerf.filter((u) => u.trafficLight === 'stalled').length,
        needsAttention: userPerf.filter((u) => u.trafficLight === 'needs_attention').length,
        onTrack: userPerf.filter((u) => u.trafficLight === 'on_track').length,
      },
    });
  } catch (err) {
    console.error('[Department detail GET]', err);
    res.status(500).json({ error: 'Failed to fetch department detail.' });
  }
});

// GET /api/departments/:id/users — every user in the department with their
// individual performance stats + traffic-light status, sorted so stalled
// reps surface first (matches the admin's actual question: who needs
// attention right now).
router.get('/:id/users', authenticateToken, requireRole('super_admin', 'dept_admin', 'user'), async (req, res) => {
  const departmentId = parseInt(req.params.id, 10);
  if (!assertDeptAccess(req, res, departmentId)) return;
  try {
    const dept = await db.query('SELECT id FROM departments WHERE id = $1', [departmentId]);
    if (dept.rows.length === 0) return res.status(404).json({ error: 'Department not found.' });

    const users = await computeUserPerformance(departmentId);
    const order = { stalled: 0, needs_attention: 1, on_track: 2 };
    users.sort((a, b) => order[a.trafficLight] - order[b.trafficLight]);
    res.json(users);
  } catch (err) {
    console.error('[Department users GET]', err);
    res.status(500).json({ error: 'Failed to fetch department users.' });
  }
});

// GET /api/departments/:id/services — super_admin, or the dept_admin / user of that department.
router.get('/:id/services', authenticateToken, requireRole('super_admin', 'dept_admin', 'user'), async (req, res) => {
  const departmentId = parseInt(req.params.id, 10);
  if (!assertDeptAccess(req, res, departmentId)) return;
  try {
    const { rows } = await db.query(`
      SELECT c.id, c.name, c.slug, c.is_active, c.created_at,
        (SELECT COUNT(*) FROM users u WHERE u.category_id = c.id) as user_count
      FROM categories c
      WHERE c.department_id = $1
      ORDER BY c.name ASC
    `, [departmentId]);
    res.json(rows);
  } catch (err) {
    console.error('[Services GET]', err);
    res.status(500).json({ error: 'Failed to fetch services.' });
  }
});

// POST /api/departments/:id/services — super_admin, or the dept_admin of that department.
router.post('/:id/services', authenticateToken, requireRole('super_admin', 'dept_admin'), async (req, res) => {
  const departmentId = parseInt(req.params.id, 10);
  if (!assertDeptAccess(req, res, departmentId)) return;
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Service name is required.' });
  }
  const slug = slugify(name);
  if (!slug) {
    return res.status(400).json({ error: 'Service name must contain at least one alphanumeric character.' });
  }
  try {
    const { rows: dept } = await db.query('SELECT id, is_active FROM departments WHERE id = $1', [departmentId]);
    if (dept.length === 0) return res.status(404).json({ error: 'Department not found.' });
    if (!dept[0].is_active) return res.status(400).json({ error: 'Cannot add a service to an inactive department.' });

    const { rows } = await db.query(
      `INSERT INTO categories (department_id, name, slug, created_by) VALUES ($1, $2, $3, $4)
       RETURNING id, department_id, name, slug, is_active, created_at`,
      [departmentId, name.trim(), slug, req.user.id]
    );

    await db.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details) VALUES ($1, 'create', 'category', $2, $3)`,
      [req.user.id, String(rows[0].id), `Created service "${rows[0].name}" in department ${departmentId}`]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A service with this name already exists in this department.' });
    }
    console.error('[Services POST]', err);
    res.status(500).json({ error: 'Failed to create service.' });
  }
});

// PATCH /api/services/:id — super_admin, or the dept_admin owning the parent department.
// Mounted separately below at /api/services since it isn't nested under a department id.
export const servicesRouter = Router();

servicesRouter.patch('/:id', authenticateToken, requireRole('super_admin', 'dept_admin'), async (req, res) => {
  const categoryId = parseInt(req.params.id, 10);
  const { name, is_active } = req.body;
  try {
    const { rows: existing } = await db.query('SELECT * FROM categories WHERE id = $1', [categoryId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Service not found.' });
    if (!assertDeptAccess(req, res, existing[0].department_id)) return;

    if (is_active === false && existing[0].is_active) {
      const { rows: blocking } = await db.query(
        `SELECT COUNT(*) as count FROM renewals WHERE category_id = $1 AND is_deleted = FALSE AND status != 'Expired'`,
        [categoryId]
      );
      const count = parseInt(blocking[0].count, 10);
      if (count > 0) {
        return res.status(400).json({ error: `Cannot deactivate: ${count} active, non-expired renewal(s) still reference this service.` });
      }
    }

    const fields = [];
    const params = [];
    if (typeof name === 'string' && name.trim()) {
      params.push(name.trim());
      fields.push(`name = $${params.length}`);
      params.push(slugify(name));
      fields.push(`slug = $${params.length}`);
    }
    if (typeof is_active === 'boolean') {
      params.push(is_active);
      fields.push(`is_active = $${params.length}`);
    }
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update.' });
    }
    params.push(categoryId);
    const { rows } = await db.query(
      `UPDATE categories SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING id, department_id, name, slug, is_active, created_at`,
      params
    );

    await db.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details) VALUES ($1, 'update', 'category', $2, $3)`,
      [req.user.id, String(categoryId), `Updated service: ${rows[0].name}`]
    );

    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A service with this name already exists in this department.' });
    }
    console.error('[Services PATCH]', err);
    res.status(500).json({ error: 'Failed to update service.' });
  }
});

export default router;
