// Seeds users + a realistic-looking (but entirely fictional) set of renewal
// records for client demos. Safe to run multiple times — it skips inserting
// data that already exists (by unique_id for renewals, by email for users).
import bcrypt from 'bcryptjs';
import db, { initDb } from './db.js';

const AVATAR_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];

const DEMO_USERS = [
  { email: 'admin.demo@marslab.work', full_name: 'Aditi Sharma', role: 'admin', password: 'Demo@1234' },
  { email: 'sales.demo1@marslab.work', full_name: 'Rohan Mehta', role: 'sales', password: 'Demo@1234' },
  { email: 'sales.demo2@marslab.work', full_name: 'Priya Nair', role: 'sales', password: 'Demo@1234' },
];

const VENDORS = ['Microsoft', 'AWS', 'Zoho', 'Acronis', 'Sophos', 'Seqrite', 'Tally', 'GWS'];
const SERVICES = ['M365', 'AWS', 'Zoho', 'AMC', 'Firewall', 'Domain', 'SSL', 'Storage'];
const CLIENTS = [
  'Bluewave Textiles', 'Coral Reef Logistics', 'Novagrid Energy', 'Sunrise Retail Group',
  'Pinnacle Manufacturing', 'Harborline Shipping', 'Evergreen Foods', 'Crestpoint Realty',
  'Nimbus Cloud Services', 'Ferrous Metals Co', 'BrightPath Education', 'Silverline Pharma',
  'Oakridge Constructions', 'Meridian Freight', 'Lotus Hospitality Group',
];

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function statusForOffset(days) {
  if (days < 0) return 'Expired';
  if (days <= 30) return 'Pending Renewal';
  return 'Active';
}

async function seedUsers() {
  const idsByEmail = {};
  for (const u of DEMO_USERS) {
    const { rows } = await db.query('SELECT id FROM users WHERE email = $1', [u.email]);
    if (rows.length > 0) {
      idsByEmail[u.email] = rows[0].id;
      continue;
    }
    const hash = await bcrypt.hash(u.password, 10);
    const username = u.email.split('@')[0];
    const avatar_color = pick(AVATAR_COLORS);
    const { rows: inserted } = await db.query(
      `INSERT INTO users (username, email, password, full_name, role, avatar_color, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING id`,
      [username, u.email, hash, u.full_name, u.role, avatar_color]
    );
    idsByEmail[u.email] = inserted[0].id;
    console.log(`  + user ${u.full_name} <${u.email}> (${u.role}) / password: ${u.password}`);
  }
  return idsByEmail;
}

async function seedRenewals(idsByEmail) {
  const salesUsers = DEMO_USERS.filter((u) => u.role === 'sales');
  // Spread renewal dates across expired / due-soon / healthy so the
  // dashboard, reports, and email-ladder logic all have something to show.
  const offsets = [-14, -3, 2, 6, 10, 18, 25, 29, 45, 60, 90, 120, 150, 210, 300];

  let created = 0;
  for (let i = 0; i < CLIENTS.length; i++) {
    const client = CLIENTS[i];
    const offset = offsets[i % offsets.length];
    const renewal_date = addDays(offset);
    const status = statusForOffset(offset);
    const vendorIdx = i % VENDORS.length;
    const vendor = VENDORS[vendorIdx];
    const service = SERVICES[vendorIdx];
    const owner = salesUsers[i % salesUsers.length];
    const unique_id = `DEMO-${String(i + 1).padStart(3, '0')}`;

    const { rows: existing } = await db.query('SELECT id FROM renewals WHERE unique_id = $1', [unique_id]);
    if (existing.length > 0) continue;

    const quantity = 1 + (i % 5);
    const purchase_cost = 5000 + (i * 733) % 20000;
    const sales_cost = purchase_cost * 1.2;
    const value = sales_cost * quantity;
    const profit = value - purchase_cost * quantity;

    await db.query(
      `INSERT INTO renewals (
        unique_id, client_name, service, renewal_date, value, owner, client_email, sales_email,
        contact_number, status, locked, product, description, quantity,
        purchase_cost, total_purchase_cost, sales_cost, total_sales_cost, profit,
        vendor, entity, invoice_status, plan_period, created_by
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24
      )`,
      [
        unique_id,
        client,
        service,
        renewal_date,
        value.toFixed(2),
        owner.full_name,
        `accounts@${client.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
        owner.email,
        `+91 9${String(100000000 + i * 37).slice(0, 9)}`,
        status,
        1,
        `${vendor} ${service} License`,
        `${service} subscription for ${client} (demo data)`,
        quantity,
        purchase_cost.toFixed(2),
        (purchase_cost * quantity).toFixed(2),
        sales_cost.toFixed(2),
        (sales_cost * quantity).toFixed(2),
        profit.toFixed(2),
        vendor,
        'MarsLab Technologies',
        offset < 0 ? 'Sent' : 'Not',
        pick(['monthly_plan', 'quarterly_plan', 'yearly_plan']),
        idsByEmail[owner.email] || null,
      ]
    );
    created++;
  }
  return created;
}

async function main() {
  await initDb();
  console.log('Seeding demo users...');
  const idsByEmail = await seedUsers();
  console.log('Seeding demo renewals...');
  const created = await seedRenewals(idsByEmail);
  console.log(`Done. ${created} new renewal record(s) created.`);
  console.log('\nDemo login credentials:');
  for (const u of DEMO_USERS) {
    console.log(`  ${u.role.padEnd(6)} ${u.email} / ${u.password}`);
  }
  console.log('\n(Or use the "Quick Demo Login" panel on the login page — no password needed.)');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
