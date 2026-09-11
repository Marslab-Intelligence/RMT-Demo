import { Router } from 'express';
import db from '../db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { computeUserPerformance } from '../utils/userMetrics.js';

const router = Router();

// Every route here takes an optional ?departmentId= and enforces the same
// rule: super_admin may pass any department id or omit it entirely (company-
// wide); dept_admin/user are always forced onto their own department_id,
// regardless of what they pass — never trust a client-supplied department
// filter for anyone but super_admin.
function resolveScopedDepartmentId(req, res) {
  const { role, departmentId: ownDeptId } = req.user;
  if (role === 'super_admin') {
    const requested = req.query.departmentId ? parseInt(req.query.departmentId, 10) : null;
    return { departmentId: requested, ok: true };
  }
  return { departmentId: ownDeptId, ok: true };
}

// GET /api/analytics/vendor-concentration?departmentId=
// How much revenue/profit rides on each vendor — if one vendor is a large
// share of profit, that's a concentration risk worth surfacing, not
// discovering later.
router.get('/vendor-concentration', authenticateToken, requireRole('super_admin', 'dept_admin'), async (req, res) => {
  const { departmentId } = resolveScopedDepartmentId(req, res);
  try {
    const params = [];
    let clause = '';
    if (departmentId !== null) {
      params.push(departmentId);
      clause = ` AND department_id = $${params.length}`;
    }
    const { rows } = await db.query(`
      SELECT COALESCE(NULLIF(vendor, ''), 'Unspecified') as vendor,
        COUNT(*)::int as renewal_count,
        COALESCE(SUM(value), 0)::float as revenue,
        COALESCE(SUM(profit), 0)::float as profit
      FROM renewals
      WHERE is_deleted = false${clause}
      GROUP BY vendor
      ORDER BY revenue DESC
    `, params);

    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
    const totalProfit = rows.reduce((s, r) => s + r.profit, 0);
    res.json({
      totalRevenue,
      totalProfit,
      vendors: rows.map((r) => ({
        vendor: r.vendor,
        renewalCount: r.renewal_count,
        revenue: r.revenue,
        profit: r.profit,
        revenueSharePct: totalRevenue > 0 ? Math.round((r.revenue / totalRevenue) * 1000) / 10 : 0,
        profitSharePct: totalProfit !== 0 ? Math.round((r.profit / totalProfit) * 1000) / 10 : 0,
      })),
    });
  } catch (err) {
    console.error('[Vendor concentration GET]', err);
    res.status(500).json({ error: 'Failed to fetch vendor concentration.' });
  }
});

// GET /api/analytics/expiry-cliff?departmentId=
// Forward-looking revenue at risk: renewals expiring in the next 30/60/90
// days that have NO logged action yet (renewal_history) — the earliest
// warning signal, and the same list an admin can act on directly (this
// doubles as the "untouched renewals" reassignment queue).
router.get('/expiry-cliff', authenticateToken, requireRole('super_admin', 'dept_admin'), async (req, res) => {
  const { departmentId } = resolveScopedDepartmentId(req, res);
  try {
    const params = [];
    let clause = '';
    if (departmentId !== null) {
      params.push(departmentId);
      clause = ` AND r.department_id = $${params.length}`;
    }
    const { rows } = await db.query(`
      SELECT r.id, r.unique_id, r.client_name, r.service, r.renewal_date, r.value, r.owner, r.department_id, d.name as department_name,
        (r.renewal_date - CURRENT_DATE) as days_out
      FROM renewals r
      LEFT JOIN departments d ON d.id = r.department_id
      WHERE r.is_deleted = false
        AND r.status IN ('Active', 'Pending Renewal')
        AND (r.renewal_confirmation IS NULL OR r.renewal_confirmation != 'renewed')
        AND r.renewal_date IS NOT NULL
        AND r.renewal_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '90 days')::date
        AND NOT EXISTS (SELECT 1 FROM renewal_history rh WHERE rh.renewal_id = r.id)
        ${clause}
      ORDER BY r.renewal_date ASC
    `, params);

    const buckets = { within30: [], within60: [], within90: [] };
    for (const r of rows) {
      const item = {
        id: r.id, uniqueId: r.unique_id, clientName: r.client_name, service: r.service,
        renewalDate: r.renewal_date, value: parseFloat(r.value), owner: r.owner,
        departmentId: r.department_id, departmentName: r.department_name, daysOut: r.days_out,
      };
      if (r.days_out <= 30) buckets.within30.push(item);
      else if (r.days_out <= 60) buckets.within60.push(item);
      else buckets.within90.push(item);
    }

    const sumValue = (arr) => arr.reduce((s, x) => s + x.value, 0);
    res.json({
      buckets,
      summary: {
        within30: { count: buckets.within30.length, value: sumValue(buckets.within30) },
        within60: { count: buckets.within60.length, value: sumValue(buckets.within60) },
        within90: { count: buckets.within90.length, value: sumValue(buckets.within90) },
      },
    });
  } catch (err) {
    console.error('[Expiry cliff GET]', err);
    res.status(500).json({ error: 'Failed to fetch expiry cliff.' });
  }
});

// GET /api/analytics/leaderboard?departmentId=
// Reps ranked by profit generated and by conversion rate — recognition and
// coaching both get a number to point at. super_admin omitting
// departmentId gets a company-wide leaderboard across every department.
router.get('/leaderboard', authenticateToken, requireRole('super_admin', 'dept_admin'), async (req, res) => {
  const { departmentId } = resolveScopedDepartmentId(req, res);
  try {
    const users = await computeUserPerformance(departmentId);
    const enrichedUsers = users.map((u) => ({
      ...u,
      conversionRatePct: (u.renewedCount + (u.lostCount || 0)) > 0
        ? Math.round((u.renewedCount / (u.renewedCount + (u.lostCount || 0))) * 1000) / 10
        : (u.ownedCount > 0 ? Math.round((u.renewedCount / u.ownedCount) * 1000) / 10 : 0)
    }));
    const byProfit = [...enrichedUsers].sort((a, b) => b.totalProfit - a.totalProfit);
    const byConversion = [...enrichedUsers].sort((a, b) => b.conversionRatePct - a.conversionRatePct);
    res.json({ byProfit, byConversion });
  } catch (err) {
    console.error('[Leaderboard GET]', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard.' });
  }
});

export default router;
