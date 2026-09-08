import { Router } from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { computeUserPerformance } from '../utils/userMetrics.js';

const router = Router();

// GET /api/users/:id/activity — a single user's performance metrics (same
// definitions as GET /api/departments/:id/users, computed via the same
// shared helper so the two views can never disagree) plus a recent-activity
// timeline and the renewals currently on their desk. Visible to: the user
// themselves, the dept_admin of their department, or super_admin.
router.get('/:id/activity', authenticateToken, async (req, res) => {
  const targetUserId = parseInt(req.params.id, 10);
  try {
    const { rows: targetRows } = await db.query(
      'SELECT id, full_name, email, role, avatar_color, department_id, category_id FROM users WHERE id = $1',
      [targetUserId]
    );
    if (targetRows.length === 0) return res.status(404).json({ error: 'User not found.' });
    const target = targetRows[0];

    const isSelf = req.user.id === target.id;
    const isSuperAdmin = req.user.role === 'super_admin';
    const isOwningDeptAdmin = req.user.role === 'dept_admin' && req.user.departmentId === target.department_id;
    if (!isSelf && !isSuperAdmin && !isOwningDeptAdmin) {
      return res.status(403).json({ error: 'You do not have access to this user\'s activity.' });
    }

    if (target.role !== 'user' || !target.department_id) {
      return res.json({
        user: { id: target.id, fullName: target.full_name, email: target.email, role: target.role },
        performance: null,
        timeline: [],
        ownedRenewals: [],
        message: 'Activity metrics only apply to category-scoped user accounts.',
      });
    }

    const [performanceList, timelineRes, ownedRes] = await Promise.all([
      computeUserPerformance(target.department_id, target.id),
      db.query(`
        SELECT rh.id, rh.action, rh.performed_at, r.id as renewal_id, r.unique_id, r.client_name, r.service
        FROM renewal_history rh
        JOIN renewals r ON r.id = rh.renewal_id
        WHERE rh.performed_by = $1
        ORDER BY rh.performed_at DESC
        LIMIT 50
      `, [target.id]),
      db.query(`
        SELECT id, unique_id, client_name, service, renewal_date, value, status, renewal_confirmation, follow_up_status
        FROM renewals
        WHERE is_deleted = false AND department_id = $1
          AND (LOWER(owner) = LOWER($2) OR LOWER(sales_email) = LOWER($3))
        ORDER BY renewal_date ASC NULLS LAST
      `, [target.department_id, target.full_name || '', target.email || '']),
    ]);

    res.json({
      user: { id: target.id, fullName: target.full_name, email: target.email, avatarColor: target.avatar_color },
      performance: performanceList[0] || null,
      timeline: timelineRes.rows,
      ownedRenewals: ownedRes.rows,
    });
  } catch (err) {
    console.error('[User activity GET]', err);
    res.status(500).json({ error: 'Failed to fetch user activity.' });
  }
});

export default router;
