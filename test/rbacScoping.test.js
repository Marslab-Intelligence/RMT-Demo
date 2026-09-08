import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import db from '../server/db.js';
import { buildScopeClause, isRecordVisibleToUser } from '../server/utils/scope.js';

// Verifies the RBAC v2 hierarchy against the REAL local Postgres sandbox
// (house style here is to hit a real DB, not mock it — see server/utils/scope.js's
// own history). Reuses the Software/Hardware departments + AWS/Microsoft/
// Servers categories that server/db.js's initDb() seeds unconditionally, and
// cleans up every row it inserts.

let softwareDeptId, hardwareDeptId, awsCatId, msCatId, serversCatId;
const insertedRenewalIds = [];
const testUniqueIds = ['RBAC-TEST-AWS', 'RBAC-TEST-MS', 'RBAC-TEST-HW'];

const superAdmin = { role: 'super_admin' };
const softwareDeptAdmin = () => ({ role: 'dept_admin', departmentId: softwareDeptId });
const hardwareDeptAdmin = () => ({ role: 'dept_admin', departmentId: hardwareDeptId });
const awsUser = () => ({ role: 'user', departmentId: softwareDeptId, categoryId: awsCatId, fullName: 'AWS Owner', email: 'aws.owner@rbactest.local' });
const msUser = () => ({ role: 'user', departmentId: softwareDeptId, categoryId: msCatId, fullName: 'MS Owner', email: 'ms.owner@rbactest.local' });

before(async () => {
  const { rows: [swDept] } = await db.query("SELECT id FROM departments WHERE slug = 'software-renewals'");
  const { rows: [hwDept] } = await db.query("SELECT id FROM departments WHERE slug = 'hardware-renewals'");
  softwareDeptId = swDept.id;
  hardwareDeptId = hwDept.id;

  const { rows: [aws] } = await db.query("SELECT id FROM categories WHERE department_id = $1 AND slug = 'aws'", [softwareDeptId]);
  const { rows: [ms] } = await db.query("SELECT id FROM categories WHERE department_id = $1 AND slug = 'microsoft'", [softwareDeptId]);
  const { rows: [servers] } = await db.query("SELECT id FROM categories WHERE department_id = $1 AND slug = 'servers'", [hardwareDeptId]);
  awsCatId = aws.id;
  msCatId = ms.id;
  serversCatId = servers.id;

  await db.query('DELETE FROM renewals WHERE unique_id = ANY($1)', [testUniqueIds]);

  const rows = [
    ['RBAC-TEST-AWS', 'RBAC Test AWS Client', 'AWS', 'AWS Owner', 'aws.owner@rbactest.local', softwareDeptId, awsCatId],
    ['RBAC-TEST-MS', 'RBAC Test MS Client', 'Microsoft', 'MS Owner', 'ms.owner@rbactest.local', softwareDeptId, msCatId],
    ['RBAC-TEST-HW', 'RBAC Test Hardware Client', 'Servers', 'HW Owner', 'hw.owner@rbactest.local', hardwareDeptId, serversCatId],
  ];
  for (const [unique_id, client_name, service, owner, client_email, department_id, category_id] of rows) {
    const { rows: [inserted] } = await db.query(
      `INSERT INTO renewals (unique_id, client_name, service, owner, client_email, department_id, category_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [unique_id, client_name, service, owner, client_email, department_id, category_id]
    );
    insertedRenewalIds.push(inserted.id);
  }
});

after(async () => {
  await db.query('DELETE FROM renewals WHERE unique_id = ANY($1)', [testUniqueIds]);
});

test('RBAC v2 - a category user only ever sees their own service, never a sibling service in the same department', async () => {
  const scope = buildScopeClause(awsUser(), 2);
  const { rows } = await db.query(
    `SELECT unique_id FROM renewals WHERE unique_id = ANY($1) ${scope.clause}`,
    [testUniqueIds, ...scope.params]
  );
  const ids = rows.map(r => r.unique_id).sort();
  assert.deepEqual(ids, ['RBAC-TEST-AWS']);
});

test('RBAC v2 - a dept_admin sees every record in their department across services, never another department', async () => {
  const scope = buildScopeClause(softwareDeptAdmin(), 2);
  const { rows } = await db.query(
    `SELECT unique_id FROM renewals WHERE unique_id = ANY($1) ${scope.clause}`,
    [testUniqueIds, ...scope.params]
  );
  const ids = rows.map(r => r.unique_id).sort();
  assert.deepEqual(ids, ['RBAC-TEST-AWS', 'RBAC-TEST-MS']);
});

test('RBAC v2 - a different department\'s dept_admin never sees another department\'s records', async () => {
  const scope = buildScopeClause(hardwareDeptAdmin(), 2);
  const { rows } = await db.query(
    `SELECT unique_id FROM renewals WHERE unique_id = ANY($1) ${scope.clause}`,
    [testUniqueIds, ...scope.params]
  );
  const ids = rows.map(r => r.unique_id).sort();
  assert.deepEqual(ids, ['RBAC-TEST-HW']);
});

test('RBAC v2 - super_admin aggregation equals the sum across every department', async () => {
  const scope = buildScopeClause(superAdmin, 2);
  const { rows } = await db.query(
    `SELECT unique_id FROM renewals WHERE unique_id = ANY($1) ${scope.clause}`,
    [testUniqueIds, ...scope.params]
  );
  const ids = rows.map(r => r.unique_id).sort();
  assert.deepEqual(ids, ['RBAC-TEST-AWS', 'RBAC-TEST-HW', 'RBAC-TEST-MS']);
});

test('RBAC v2 - a user in the same category but not the record owner still cannot see it', async () => {
  const impostor = { role: 'user', departmentId: softwareDeptId, categoryId: awsCatId, fullName: 'Someone Else', email: 'someone.else@rbactest.local' };
  const scope = buildScopeClause(impostor, 2);
  const { rows } = await db.query(
    `SELECT unique_id FROM renewals WHERE unique_id = ANY($1) ${scope.clause}`,
    [testUniqueIds, ...scope.params]
  );
  assert.deepEqual(rows.map(r => r.unique_id), []);
});

test('RBAC v2 - isRecordVisibleToUser agrees with the SQL-level scoping for the same three roles', async () => {
  const { rows } = await db.query('SELECT * FROM renewals WHERE unique_id = $1', ['RBAC-TEST-MS']);
  const msRecord = rows[0];

  assert.equal(isRecordVisibleToUser(msRecord, superAdmin), true);
  assert.equal(isRecordVisibleToUser(msRecord, softwareDeptAdmin()), true);
  assert.equal(isRecordVisibleToUser(msRecord, hardwareDeptAdmin()), false);
  assert.equal(isRecordVisibleToUser(msRecord, awsUser()), false);
  assert.equal(isRecordVisibleToUser(msRecord, msUser()), true);
});

test('RBAC v2 - department user can read categories for their department', async () => {
  const { rows } = await db.query(
    'SELECT id, name FROM categories WHERE department_id = $1 AND is_active = TRUE',
    [softwareDeptId]
  );
  assert.ok(rows.length > 0);
  assert.ok(rows.some(r => r.id === awsCatId));
});

