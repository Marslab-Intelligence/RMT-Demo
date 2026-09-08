import db from '../db.js';

// Shared "is this user working correctly" aggregation — used by both
// GET /api/departments/:id/users (whole-department list) and
// GET /api/users/:id/activity (single user). One query, parameterized by an
// optional single user id, so the metric definitions can't drift between
// the list view and the detail view.
//
// A user's owned renewals are matched the same way RBAC scoping matches them
// (server/utils/scope.js): department_id match AND (owner name OR
// sales_email match) — never role='user' users seeing each other's rows,
// but here we're aggregating server-side across all of a department's users
// deliberately, for the admin's activity view.
//
// departmentId === null means "every department" — only ever passed by a
// super_admin caller (company-wide leaderboard); route handlers are
// responsible for enforcing that, this function does not re-check role.
export async function computeUserPerformance(departmentId, onlyUserId = null) {
  const params = [];
  let deptUserFilter = "role = 'user'";
  let renewalDeptFilter = '';
  if (departmentId !== null) {
    params.push(departmentId);
    deptUserFilter = `department_id = $${params.length} AND role = 'user'`;
    renewalDeptFilter = ` AND r.department_id = $${params.length}`;
  }
  let userFilter = '';
  if (onlyUserId) {
    params.push(onlyUserId);
    userFilter = ` AND du.id = $${params.length}`;
  }

  const { rows } = await db.query(`
    WITH dept_users AS (
      SELECT id, full_name, email, role, avatar_color, category_id, department_id, is_active
      FROM users du
      WHERE ${deptUserFilter}${userFilter}
    ),
    user_renewals AS (
      SELECT r.*, du.id AS assigned_user_id
      FROM renewals r
      JOIN dept_users du
        ON (LOWER(r.owner) = LOWER(du.full_name) OR LOWER(r.sales_email) = LOWER(du.email))
      WHERE r.is_deleted = false${renewalDeptFilter}
    ),
    first_action_by_renewal AS (
      SELECT renewal_id, MIN(performed_at) AS first_action_at
      FROM renewal_history
      GROUP BY renewal_id
    ),
    history_by_user AS (
      SELECT rh.performed_by AS user_id, MAX(rh.performed_at) AS last_activity, COUNT(*) AS total_actions
      FROM renewal_history rh
      JOIN dept_users du ON rh.performed_by = du.id
      GROUP BY rh.performed_by
    ),
    untouched_overdue AS (
      SELECT ur.assigned_user_id AS user_id, COUNT(DISTINCT ur.id) AS untouched_overdue_count
      FROM user_renewals ur
      WHERE (ur.renewal_date < CURRENT_DATE OR ur.status = 'Expired')
        AND ur.status != 'Renewed'
        AND (ur.renewal_confirmation IS NULL OR ur.renewal_confirmation != 'renewed')
        AND NOT EXISTS (SELECT 1 FROM renewal_history rh WHERE rh.renewal_id = ur.id)
      GROUP BY ur.assigned_user_id
    )
    SELECT
      du.id, du.full_name, du.email, du.avatar_color, du.is_active, du.department_id, d.name AS department_name,
      COUNT(ur.id) AS owned_count,
      COUNT(*) FILTER (WHERE ur.status = 'Renewed' OR ur.renewal_confirmation = 'renewed') AS renewed_count,
      COUNT(*) FILTER (WHERE ur.renewal_confirmation IN ('lost', 'cancelled', 'service_discontinued')) AS lost_count,
      COUNT(*) FILTER (
        WHERE (ur.renewal_date < CURRENT_DATE OR ur.status = 'Expired')
          AND ur.status != 'Renewed'
          AND (ur.renewal_confirmation IS NULL OR ur.renewal_confirmation != 'renewed')
      ) AS overdue_count,
      COALESCE(SUM(ur.value) FILTER (
        WHERE (ur.renewal_date < CURRENT_DATE OR ur.status = 'Expired')
          AND ur.status != 'Renewed'
          AND (ur.renewal_confirmation IS NULL OR ur.renewal_confirmation != 'renewed')
      ), 0) AS overdue_value,
      COUNT(*) FILTER (
        WHERE ur.follow_up_status != 'Completed' AND ur.status IN ('Active', 'Pending Renewal')
      ) AS followups_due,
      COALESCE(SUM(ur.value), 0) AS pipeline_value,
      COALESCE(SUM(ur.profit), 0) AS total_profit,
      -- The >= guard excludes rows where the first logged action predates
      -- the renewal's created_at (possible with backfilled/imported
      -- history whose timestamps don't line up with insert order) — those
      -- would otherwise produce a nonsensical negative "days to act".
      ROUND(AVG(EXTRACT(EPOCH FROM (fabr.first_action_at - ur.created_at)) / 86400) FILTER (WHERE fabr.first_action_at IS NOT NULL AND fabr.first_action_at >= ur.created_at))::int AS avg_days_to_first_action,
      hbu.last_activity,
      COALESCE(hbu.total_actions, 0) AS total_actions,
      COALESCE(uo.untouched_overdue_count, 0) AS untouched_overdue_count
    FROM dept_users du
    LEFT JOIN departments d ON d.id = du.department_id
    LEFT JOIN user_renewals ur ON ur.assigned_user_id = du.id
    LEFT JOIN first_action_by_renewal fabr ON fabr.renewal_id = ur.id
    LEFT JOIN history_by_user hbu ON hbu.user_id = du.id
    LEFT JOIN untouched_overdue uo ON uo.user_id = du.id
    GROUP BY du.id, du.full_name, du.email, du.avatar_color, du.is_active, du.department_id, d.name, hbu.last_activity, hbu.total_actions, uo.untouched_overdue_count
    ORDER BY du.full_name ASC
  `, params);

  return rows.map((u) => {
    const ownedCount = parseInt(u.owned_count, 10);
    const overdueCount = parseInt(u.overdue_count, 10);
    const untouchedOverdueCount = parseInt(u.untouched_overdue_count, 10);
    const idleDays = u.last_activity ? (Date.now() - new Date(u.last_activity).getTime()) / 86400000 : null;
    const overdueRatio = ownedCount > 0 ? overdueCount / ownedCount : 0;

    // Heuristic, not a stored value — deliberately simple so an admin can
    // reconstruct it by eye from the numbers shown alongside it: any
    // overdue renewal with zero logged action, or genuinely long idleness,
    // or a high overdue share, means "stalled"; moderate idleness/overdue
    // share means "needs attention"; otherwise "on track".
    let trafficLight = 'on_track';
    if (untouchedOverdueCount > 0 || idleDays === null || idleDays > 14 || overdueRatio > 0.3) {
      trafficLight = 'stalled';
    } else if (idleDays > 5 || overdueRatio > 0.1 || parseInt(u.followups_due, 10) > 3) {
      trafficLight = 'needs_attention';
    }

    return {
      id: u.id,
      fullName: u.full_name,
      email: u.email,
      avatarColor: u.avatar_color,
      isActive: u.is_active,
      departmentId: u.department_id,
      departmentName: u.department_name,
      ownedCount,
      renewedCount: parseInt(u.renewed_count, 10),
      lostCount: parseInt(u.lost_count, 10),
      overdueCount,
      overdueValue: parseFloat(u.overdue_value),
      followupsDue: parseInt(u.followups_due, 10),
      pipelineValue: parseFloat(u.pipeline_value),
      totalProfit: parseFloat(u.total_profit),
      avgDaysToFirstAction: u.avg_days_to_first_action === null ? null : parseInt(u.avg_days_to_first_action, 10),
      lastActivity: u.last_activity,
      idleDays: idleDays === null ? null : Math.floor(idleDays),
      totalActions: parseInt(u.total_actions, 10),
      untouchedOverdueCount,
      trafficLight,
    };
  });
}
