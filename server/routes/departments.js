import { Router } from 'express';
import db from '../db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

function slugify(name) {
  return String(name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// A dept_admin may only ever touch their own department; super_admin is
// unrestricted. Used by every /services and department PATCH route below.
function assertDeptAccess(req, res, departmentId) {
  if (req.user.role === 'super_admin') return true;
  if (req.user.role === 'dept_admin' && req.user.departmentId === departmentId) return true;
  res.status(403).json({ error: 'You do not have access to this department.' });
  return false;
}

// GET /api/departments — super_admin sees all, dept_admin sees only their own.
router.get('/', authenticateToken, requireRole('super_admin', 'dept_admin'), async (req, res) => {
  try {
    const params = [];
    let whereClause = '';
    if (req.user.role === 'dept_admin') {
      params.push(req.user.departmentId);
      whereClause = 'WHERE d.id = $1';
    }
    const { rows } = await db.query(`
      SELECT d.id, d.name, d.slug, d.is_active, d.created_at,
        (SELECT COUNT(*) FROM categories c WHERE c.department_id = d.id AND c.is_active = TRUE) as service_count,
        (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id) as user_count
      FROM departments d
      ${whereClause}
      ORDER BY d.name ASC
    `, params);
    res.json(rows);
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

// GET /api/departments/:id/services — super_admin, or the dept_admin of that department.
router.get('/:id/services', authenticateToken, requireRole('super_admin', 'dept_admin'), async (req, res) => {
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
