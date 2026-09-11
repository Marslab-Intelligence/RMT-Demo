// RBAC v2 row/query scoping — shared by renewals.js, dashboard.js,
// adminUsers.js, the AI agent's queryBuilder/queryEngine, and the SSE
// broadcast path. Generalizes the owner/sales_email scoping originally built
// for the 2-role admin/sales model into the 3-tier hierarchy:
//
//   super_admin -> no restriction (sees everything).
//   dept_admin  -> department_id must match (sees every record/user in
//                  their own department, regardless of who owns it).
//   user        -> category_id must match AND (owner or sales_email must
//                  match) — category alone is not sufficient. This is
//                  deliberate: the brief asks both for "a user only sees
//                  records assigned to their service" (category) AND "a
//                  user cannot see another user's records even inside the
//                  same service, unless they own it" (owner/assignment) —
//                  satisfying both means ANDing the two checks, which
//                  strictly narrows visibility versus either check alone
//                  and never widens what the pre-existing owner-scoping
//                  already protected.
//
// `user` here is always a decoded JWT payload (req.user) — departmentId/
// categoryId are camelCase there (see issueSession in routes/auth.js);
// DB columns are snake_case (department_id/category_id). Never mix these up.

export function isRecordVisibleToUser(record, user) {
  if (!record || !user) return false;
  if (user.role === 'super_admin' || user.role === 'ceo') return true;
  if (user.role === 'dept_admin') {
    return record.department_id != null && record.department_id === user.departmentId;
  }
  if (user.role === 'user') {
    const categoryMatch = record.category_id != null && record.category_id === user.categoryId;
    if (!categoryMatch) return false;
    const ownerMatch = (record.owner || '').toLowerCase() === (user.fullName || '').toLowerCase();
    const emailMatch = (record.sales_email || '').toLowerCase() === (user.email || '').toLowerCase();
    return ownerMatch || emailMatch;
  }
  return false; // unknown role - fail closed
}

export function assertRecordVisible(record, user, res) {
  if (!isRecordVisibleToUser(record, user)) {
    res.status(403).json({ error: 'You do not have access to this record.' });
    return false;
  }
  return true;
}

/**
 * Appends a scope condition to a hand-built SQL WHERE clause. Every route in
 * this app builds SQL with its own $N param indexing (no query builder/ORM),
 * so this returns the clause text + params to splice in at the caller's
 * current param index, rather than trying to be an Express middleware that
 * "injects" a clause generically — that doesn't fit how this codebase writes
 * queries.
 */
export function buildScopeClause(user, nextParamIndex, tableAlias = '') {
  const p = tableAlias ? `${tableAlias}.` : '';
  if (user.role === 'super_admin' || user.role === 'ceo') return { clause: '', params: [] };
  if (user.role === 'dept_admin') {
    return {
      clause: ` AND ${p}department_id = $${nextParamIndex}`,
      params: [user.departmentId],
    };
  }
  if (user.role === 'user') {
    return {
      clause: ` AND ${p}category_id = $${nextParamIndex} AND (LOWER(${p}owner) = LOWER($${nextParamIndex + 1}) OR LOWER(${p}sales_email) = LOWER($${nextParamIndex + 2}))`,
      params: [user.categoryId, user.fullName || '', user.email || ''],
    };
  }
  return { clause: ' AND 1=0', params: [] }; // unknown role - fail closed
}

/**
 * Batch-route equivalent of assertRecordVisible: narrows an ids array down
 * to the subset the caller can actually see, rather than 403ing the whole
 * batch (a bulk action against a client-supplied id list is expected to
 * sometimes include ids the UI never should have offered).
 */
export async function filterIdsByScope(db, ids, user) {
  if (user.role === 'super_admin' || user.role === 'ceo') return ids;
  if (user.role === 'dept_admin') {
    const { rows } = await db.query(
      `SELECT id FROM renewals WHERE id = ANY($1) AND department_id = $2`,
      [ids, user.departmentId]
    );
    return rows.map(r => r.id);
  }
  if (user.role === 'user') {
    const { rows } = await db.query(
      `SELECT id FROM renewals WHERE id = ANY($1) AND category_id = $2 AND (LOWER(owner) = LOWER($3) OR LOWER(sales_email) = LOWER($4))`,
      [ids, user.categoryId, user.fullName || '', user.email || '']
    );
    return rows.map(r => r.id);
  }
  return [];
}

/**
 * For write routes that go straight to an UPDATE by id without already
 * having fetched the row. Fetches just enough to check scope before the real
 * query runs. Returns null (and has already sent a 404/403) if the caller
 * should stop.
 */
export async function fetchAndCheckScope(db, id, user, res) {
  const { rows } = await db.query(
    'SELECT id, department_id, category_id, owner, sales_email FROM renewals WHERE id = $1',
    [id]
  );
  if (rows.length === 0) {
    res.status(404).json({ error: 'Renewal not found.' });
    return null;
  }
  if (!assertRecordVisible(rows[0], user, res)) return null;
  return rows[0];
}

/** True for the two roles that have admin-style access within their own scope. */
export function isAdminLike(role) {
  return role === 'super_admin' || role === 'dept_admin';
}

/**
 * The `notifications` table has a legacy `role` column written as the old
 * two-role labels ('admin' / 'sales') by many call sites in renewals.js.
 * Rather than rewriting every INSERT INTO notifications call site, readers
 * match against both their real role and its legacy bucket label.
 */
export function notificationRoleBuckets(role) {
  if (role === 'super_admin' || role === 'dept_admin') return [role, 'admin'];
  if (role === 'user') return [role, 'sales'];
  return [role];
}
