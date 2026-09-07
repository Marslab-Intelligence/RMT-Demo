import db, { initDb } from './db.js';

const CITIES = [
  { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
  { name: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
  { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
  { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
  { name: 'Pune', lat: 18.5204, lng: 73.8567 },
  { name: 'Coimbatore', lat: 11.0168, lng: 76.9558 },
  { name: 'Delhi NCR', lat: 28.6139, lng: 77.2090 },
  { name: 'Kochi', lat: 9.9312, lng: 76.2673 },
];

const CLIENT_COMPANIES = [
  { name: 'Agaram Technologies Pvt Ltd', domain: 'agaramtech.com', person: 'Mukunth Venkatesan', city: 'Chennai' },
  { name: 'SuperOps Technologies', domain: 'superops.ai', person: 'Denis Vincent', city: 'Chennai' },
  { name: 'SCM Cube Technologies Pvt Ltd', domain: 'scmcube.in', person: 'Mani Arumugam', city: 'Bengaluru' },
  { name: 'Talodyn Networks Private Limited', domain: 'talodyn.com', person: 'Rajthilak G', city: 'Coimbatore' },
  { name: 'Winsar Infosoft Private Limited', domain: 'winsarinfo.com', person: 'Ashok Ramakrishnan', city: 'Chennai' },
  { name: 'DNO Technologies Pvt Ltd', domain: 'dnotech.com', person: 'Preetha Raj', city: 'Chennai' },
  { name: 'Spinebiz Services Private Limited', domain: 'spinebiz.com', person: 'Santhosh VS', city: 'Mumbai' },
  { name: 'The IT Man Private Limited', domain: 'theitman.com', person: 'Viswa Anand', city: 'Chennai' },
  { name: 'CloudScale Solutions India', domain: 'cloudscalesol.com', person: 'Anand Parthasarathy', city: 'Bengaluru' },
  { name: 'NexaByte Labs India', domain: 'nexabytelabs.com', person: 'Karthik Raja', city: 'Hyderabad' },
  { name: 'InfraCore Networks Pvt Ltd', domain: 'infracore.in', person: 'Devanathan S', city: 'Chennai' },
  { name: 'Syntron Digital Systems', domain: 'syntrondigital.com', person: 'Prakash Rao', city: 'Bengaluru' },
  { name: 'Zephyr Mobility Technologies', domain: 'zephyrmobility.io', person: 'Naveen Chandran', city: 'Chennai' },
  { name: 'OmniCloud Analytics LLP', domain: 'omnicloud.in', person: 'Siddharth Iyer', city: 'Pune' },
  { name: 'Vanguard Cyber Defense Systems', domain: 'vanguardcyber.com', person: 'Harish Babu', city: 'Bengaluru' },
  { name: 'AppVantage Software Solutions', domain: 'appvantage.in', person: 'Meenakshi Sundaram', city: 'Chennai' },
  { name: 'Trident Data Engineering', domain: 'tridentdata.io', person: 'Venkat Raman', city: 'Hyderabad' },
  { name: 'PixelCraft Interactive', domain: 'pixelcraft.co', person: 'Divya Nair', city: 'Bengaluru' },
  { name: 'AlphaMatrix AI Labs', domain: 'alphamatrix.ai', person: 'Arunmozhi Varman', city: 'Chennai' },
  { name: 'CyberShield InfoTech Solutions', domain: 'cybershield.in', person: 'Rohit Kulkarni', city: 'Pune' },
  { name: 'Aadit Auto Company Pvt Ltd', domain: 'aaditauto.com', person: 'Vikram Doraisamy', city: 'Chennai' },
  { name: 'Sri Balaji Castings Pvt Ltd', domain: 'sbcmail.in', person: 'Sathish Kumar M', city: 'Coimbatore' },
  { name: 'Swelect Energy Systems Limited', domain: 'swelectes.com', person: 'Suresh Babu E', city: 'Salem' },
  { name: 'Coral Reef Logistics India', domain: 'coralreefs.in', person: 'Subramanian Swamy', city: 'Kochi' },
  { name: 'Harborline Shipping & Freight', domain: 'harborlineship.com', person: 'Capt. Jude Fernando', city: 'Chennai' },
  { name: 'Sunrise Retail Group India', domain: 'sunriseretail.in', person: 'Jayanthi Sridhar', city: 'Bengaluru' },
  { name: 'Silverline Pharmaceuticals Ltd', domain: 'silverlinepharma.com', person: 'Dr. Aravind Swaminathan', city: 'Hyderabad' },
  { name: 'Apex Diagnostic Labs Chain', domain: 'apexdiagnostics.in', person: 'Dr. Priya Varma', city: 'Chennai' },
  { name: 'MedVantage Hospitals Group', domain: 'medvantage.in', person: 'Senthil Kumaran', city: 'Bengaluru' },
  { name: 'BrightPath Education Systems', domain: 'brightpathedu.in', person: 'Prof. Sridharan K', city: 'Chennai' },
];

const SERVICE_CATALOG = [
  {
    service: 'MS365',
    vendor: 'Microsoft',
    products: [
      { name: 'MS365 Business Standard', unitBuy: 647, unitSell: 738, desc: 'Full desktop Office apps, Teams, cloud storage 1TB' },
      { name: 'MS365 Business Premium', unitBuy: 1450, unitSell: 1750, desc: 'Standard + Defender for Business, Intune, conditional access' },
      { name: 'MS365 E3 Enterprise', unitBuy: 2400, unitSell: 2850, desc: 'Enterprise mobility, DLP, Windows 11 Enterprise' },
    ],
    minQty: 10, maxQty: 100,
  },
  {
    service: 'GWS',
    vendor: 'Google',
    products: [
      { name: 'Google Workspace Business Standard', unitBuy: 680, unitSell: 840, desc: 'Custom business email, 2TB pooled storage, 150-participant meetings' },
      { name: 'Google Workspace Business Plus', unitBuy: 1300, unitSell: 1650, desc: 'Vault eDiscovery, 5TB pooled storage, enhanced security' },
    ],
    minQty: 10, maxQty: 80,
  },
  {
    service: 'AWS',
    vendor: 'Amazon Web Services',
    products: [
      { name: 'AWS Cloud Compute EC2 Reserved', unitBuy: 12500, unitSell: 15200, desc: '3-year reserved EC2 production clusters with high availability' },
      { name: 'AWS S3 Enterprise Storage Tier', unitBuy: 6200, unitSell: 7800, desc: 'Intelligent tiering, cross-region replication, immutable retention' },
    ],
    minQty: 1, maxQty: 5,
  },
  {
    service: 'Firewall',
    vendor: 'Fortinet',
    products: [
      { name: 'FortiGate 100F UTM Bundle', unitBuy: 42000, unitSell: 51000, desc: 'Enterprise IPS, AV, web filter, 24x7 FortiCare license renewal' },
      { name: 'Sophos XGS 2100 Standard Protection', unitBuy: 38000, unitSell: 46500, desc: 'Network protection, web filtering, zero-day threat prevention' },
    ],
    minQty: 1, maxQty: 4,
  },
  {
    service: 'Storage',
    vendor: 'Synology',
    products: [
      { name: 'Synology Enterprise NAS Support Renewal', unitBuy: 18000, unitSell: 22500, desc: '24/7 next business day hardware replacement and firmware support' },
    ],
    minQty: 1, maxQty: 6,
  },
];

const EXPIRY_REASONS = [
  'Client budget constraints and internal IT spend freezes',
  'Migrated to competing vendor offering introductory discount',
  'Consolidated into global corporate enterprise agreement',
  'Client discontinued business unit operating this infrastructure',
  'Downsized team footprint; reduced overall license requirements',
];

const FOLLOWUP_REMARKS = [
  'Spoke with IT Director. Quote approved in principle, PO in approval flow.',
  'Commercial terms renegotiated. 3-year term offered for 8% price lock.',
  'Contract sent for legal and compliance review. Expected sign-off this week.',
  'Meeting held at client office. Scope finalized, awaiting finance release.',
  'Follow-up scheduled post quarterly budget review meeting.',
];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function calculateEmailFlags(daysOffset) {
  return {
    day_30_sent: daysOffset <= 30 ? 'Yes' : 'No',
    day_20_sent: daysOffset <= 20 ? 'Yes' : 'No',
    day_15_sent: daysOffset <= 15 ? 'Yes' : 'No',
    day_10_sent: daysOffset <= 10 ? 'Yes' : 'No',
    day_5_sent:  daysOffset <= 5  ? 'Yes' : 'No',
    day_3_sent:  daysOffset <= 3  ? 'Yes' : 'No',
    day_0_sent:  daysOffset <= 0  ? 'Yes' : 'No',
    sales_15_sent: daysOffset <= 15 ? 'Yes' : 'No',
    sales_5_sent:  daysOffset <= 5  ? 'Yes' : 'No',
    sales_3_sent:  daysOffset <= 3  ? 'Yes' : 'No',
  };
}

export async function seed30Records() {
  await initDb();
  console.log('Seeding 30 high-quality dummy renewals...');

  // Fetch existing users
  const { rows: users } = await db.query(`
    SELECT id, email, full_name, role, department_id, category_id 
    FROM users 
    ORDER BY id ASC
  `);

  if (users.length === 0) {
    throw new Error('No users found in database. Please ensure users exist before seeding renewals.');
  }

  // Fetch departments & categories
  const { rows: depts } = await db.query('SELECT id, name, slug FROM departments WHERE is_active = true');
  const { rows: categories } = await db.query('SELECT id, department_id, name, slug FROM categories WHERE is_active = true');

  const defaultDeptId = depts[0]?.id || 1;
  const deptMap = {};
  for (const d of depts) deptMap[d.slug] = d.id;

  const catMap = {};
  for (const c of categories) {
    catMap[c.slug] = c.id;
    catMap[c.name] = c.id;
  }

  const salesUsers = users.filter(u => u.role === 'user');
  const assignableUsers = salesUsers.length > 0 ? salesUsers : users;

  // 30 Contract distribution plan:
  // - 4 Expired (offsets -90 to -1 days)
  // - 1 Due Today (offset 0)
  // - 3 Due this week (offset 1 to 7)
  // - 7 Due in 8 to 30 days (Pending Renewal)
  // - 11 Active future (offset 31 to 365)
  // - 4 Renewed (offset -30 to 30)
  const contractPlans = [
    // 4 Expired
    { daysOffset: -45, status: 'Expired', renewalConfirmation: 'cancelled', expiryReason: EXPIRY_REASONS[0], invoiceStatus: 'Sent', paymentStatus: 'No' },
    { daysOffset: -28, status: 'Expired', renewalConfirmation: 'lost', expiryReason: EXPIRY_REASONS[1], invoiceStatus: 'Sent', paymentStatus: 'No' },
    { daysOffset: -12, status: 'Expired', renewalConfirmation: 'pending', expiryReason: null, invoiceStatus: 'Not', paymentStatus: 'No' },
    { daysOffset: -5,  status: 'Expired', renewalConfirmation: 'pending', expiryReason: null, invoiceStatus: 'Sent', paymentStatus: 'No' },

    // 1 Due Today
    { daysOffset: 0, status: 'Pending Renewal', renewalConfirmation: 'quote_sent', expiryReason: null, invoiceStatus: 'Sent', paymentStatus: 'No' },

    // 3 Due this week
    { daysOffset: 2, status: 'Pending Renewal', renewalConfirmation: 'reminder_sent', expiryReason: null, invoiceStatus: 'Sent', paymentStatus: 'No' },
    { daysOffset: 4, status: 'Pending Renewal', renewalConfirmation: 'awaiting_client_approval', expiryReason: null, invoiceStatus: 'Sent', paymentStatus: 'No' },
    { daysOffset: 6, status: 'Pending Renewal', renewalConfirmation: 'quote_sent', expiryReason: null, invoiceStatus: 'Not', paymentStatus: 'No' },

    // 7 Due in 8 to 30 days (Pending Renewal)
    { daysOffset: 10, status: 'Pending Renewal', renewalConfirmation: 'quote_sent', expiryReason: null, invoiceStatus: 'Sent', paymentStatus: 'No' },
    { daysOffset: 14, status: 'Pending Renewal', renewalConfirmation: 'reminder_sent', expiryReason: null, invoiceStatus: 'Not', paymentStatus: 'No' },
    { daysOffset: 18, status: 'Pending Renewal', renewalConfirmation: 'awaiting_client_approval', expiryReason: null, invoiceStatus: 'Sent', paymentStatus: 'No' },
    { daysOffset: 21, status: 'Pending Renewal', renewalConfirmation: 'pending', expiryReason: null, invoiceStatus: 'Not', paymentStatus: 'No' },
    { daysOffset: 24, status: 'Pending Renewal', renewalConfirmation: 'reminder_sent', expiryReason: null, invoiceStatus: 'Sent', paymentStatus: 'No' },
    { daysOffset: 27, status: 'Pending Renewal', renewalConfirmation: 'quote_sent', expiryReason: null, invoiceStatus: 'Sent', paymentStatus: 'No' },
    { daysOffset: 30, status: 'Pending Renewal', renewalConfirmation: 'pending', expiryReason: null, invoiceStatus: 'Not', paymentStatus: 'No' },

    // 11 Active future
    { daysOffset: 45,  status: 'Active', renewalConfirmation: 'renewed', expiryReason: null, invoiceStatus: 'Not', paymentStatus: 'No' },
    { daysOffset: 60,  status: 'Active', renewalConfirmation: 'renewed', expiryReason: null, invoiceStatus: 'Sent', paymentStatus: 'No' },
    { daysOffset: 75,  status: 'Active', renewalConfirmation: 'renewed', expiryReason: null, invoiceStatus: 'Not', paymentStatus: 'No' },
    { daysOffset: 90,  status: 'Active', renewalConfirmation: 'renewed', expiryReason: null, invoiceStatus: 'Sent', paymentStatus: 'No' },
    { daysOffset: 120, status: 'Active', renewalConfirmation: 'renewed', expiryReason: null, invoiceStatus: 'Not', paymentStatus: 'No' },
    { daysOffset: 150, status: 'Active', renewalConfirmation: 'renewed', expiryReason: null, invoiceStatus: 'Sent', paymentStatus: 'No' },
    { daysOffset: 180, status: 'Active', renewalConfirmation: 'renewed', expiryReason: null, invoiceStatus: 'Not', paymentStatus: 'No' },
    { daysOffset: 210, status: 'Active', renewalConfirmation: 'renewed', expiryReason: null, invoiceStatus: 'Sent', paymentStatus: 'No' },
    { daysOffset: 240, status: 'Active', renewalConfirmation: 'renewed', expiryReason: null, invoiceStatus: 'Not', paymentStatus: 'No' },
    { daysOffset: 300, status: 'Active', renewalConfirmation: 'renewed', expiryReason: null, invoiceStatus: 'Sent', paymentStatus: 'No' },
    { daysOffset: 330, status: 'Active', renewalConfirmation: 'renewed', expiryReason: null, invoiceStatus: 'Not', paymentStatus: 'No' },

    // 4 Renewed
    { daysOffset: -10, status: 'Renewed', renewalConfirmation: 'renewed', expiryReason: null, invoiceStatus: 'Sent', paymentStatus: 'Yes' },
    { daysOffset: 5,   status: 'Renewed', renewalConfirmation: 'renewed', expiryReason: null, invoiceStatus: 'Sent', paymentStatus: 'Yes' },
    { daysOffset: 15,  status: 'Renewed', renewalConfirmation: 'renewed', expiryReason: null, invoiceStatus: 'Sent', paymentStatus: 'Yes' },
    { daysOffset: 25,  status: 'Renewed', renewalConfirmation: 'renewed', expiryReason: null, invoiceStatus: 'Sent', paymentStatus: 'Yes' },
  ];

  const client = await db.connect();
  const createdRenewalIds = [];

  try {
    await client.query('BEGIN');

    // Get starting unique sequence number
    const { rows: maxRow } = await client.query('SELECT COALESCE(MAX(id), 0) as max_id FROM renewals');
    const startNum = parseInt(maxRow[0].max_id, 10) + 1;

    for (let i = 0; i < contractPlans.length; i++) {
      const plan = contractPlans[i];
      const unique_id = `RMT-${String(startNum + i).padStart(4, '0')}`;
      const company = CLIENT_COMPANIES[i % CLIENT_COMPANIES.length];
      const cat = SERVICE_CATALOG[i % SERVICE_CATALOG.length];
      const prod = cat.products[i % cat.products.length];
      const owner = assignableUsers[i % assignableUsers.length];
      const city = CITIES.find(c => c.name === company.city) || CITIES[i % CITIES.length];

      const client_lat = +(city.lat + (Math.random() - 0.5) * 0.05).toFixed(6);
      const client_lng = +(city.lng + (Math.random() - 0.5) * 0.05).toFixed(6);
      const renewal_date = addDays(plan.daysOffset);
      const flags = calculateEmailFlags(plan.daysOffset);

      const quantity = randInt(cat.minQty, cat.maxQty);
      const purchase_cost = prod.unitBuy;
      const margin = 0.20 + (i % 10) * 0.015;
      const sales_cost = +(purchase_cost * (1 + margin)).toFixed(2);
      const total_purchase = +(purchase_cost * quantity).toFixed(2);
      const total_sales = +(sales_cost * quantity).toFixed(2);
      const value = total_sales;
      const profit = +(total_sales - total_purchase).toFixed(2);

      const invoiceNum = plan.invoiceStatus === 'Sent' ? `INV-2026-${String(2001 + i).padStart(4, '0')}` : null;
      const invoiceDate = plan.invoiceStatus === 'Sent' ? addDays(plan.daysOffset - randInt(5, 15)) : null;
      const paymentDate = plan.paymentStatus === 'Yes' ? addDays(plan.daysOffset - randInt(1, 8)) : null;

      const followUpStatus = plan.status === 'Renewed' ? 'Completed' : pick([
        'Follow-up Scheduled', 'Quote Under Negotiation', 'PO Awaited', 'Client Agreed - Processing', 'Contacted Decision Maker'
      ]);
      const followUpRemarks = plan.status === 'Renewed' ? 'Renewal completed and payment received.' : pick(FOLLOWUP_REMARKS);
      const quoteNum = `QT-2026-${String(2001 + i).padStart(4, '0')}`;

      // Pick department & category
      const targetDeptId = owner.department_id || defaultDeptId;
      const targetCatId = owner.category_id || catMap[cat.service] || categories[0]?.id || null;

      const query = `
        INSERT INTO renewals (
          unique_id, client_name, service, renewal_date, value, owner, client_email, sales_email,
          contact_number, reference_id, status, locked, follow_up_status, follow_up_remarks,
          day_30_sent, day_20_sent, day_15_sent, day_10_sent, day_5_sent, day_3_sent, day_0_sent,
          sales_15_sent, sales_5_sent, sales_3_sent,
          renewal_confirmation, edit_status, edit_reason, expiry_reason,
          invoice_status, invoice_number, invoice_value, invoice_sent_date,
          plan_period, plan_duration, product, description, quantity,
          purchase_cost, total_purchase_cost, sales_cost, total_sales_cost, profit,
          vendor, entity, created_by, is_deleted,
          payment_status, payment_amount, payment_received_date,
          client_latitude, client_longitude, invoice_type, payment_state, quotation_number,
          department_id, category_id
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
          $15,$16,$17,$18,$19,$20,$21,$22,$23,$24,
          $25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,
          $38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50,$51,$52,$53,$54,$55,$56
        ) RETURNING id
      `;

      const values = [
        unique_id,
        company.name,
        cat.service,
        renewal_date,
        value,
        owner.full_name,
        `accounts@${company.domain}`,
        owner.email,
        `+91 ${randInt(97000, 99999)} ${randInt(10000, 99999)}`,
        `REF-${String(2000 + i)}`,
        plan.status,
        1, // locked
        followUpStatus,
        followUpRemarks,
        flags.day_30_sent,
        flags.day_20_sent,
        flags.day_15_sent,
        flags.day_10_sent,
        flags.day_5_sent,
        flags.day_3_sent,
        flags.day_0_sent,
        flags.sales_15_sent,
        flags.sales_5_sent,
        flags.sales_3_sent,
        plan.renewalConfirmation,
        null, // edit_status
        null, // edit_reason
        plan.expiryReason,
        plan.invoiceStatus,
        invoiceNum,
        invoiceNum ? value : null,
        invoiceDate,
        'yearly_plan',
        1,
        prod.name,
        `${prod.desc} for ${company.name}`,
        quantity,
        purchase_cost,
        total_purchase,
        sales_cost,
        total_sales,
        profit,
        cat.vendor,
        'MarsLab Technologies',
        owner.id,
        false,
        plan.paymentStatus,
        plan.paymentStatus === 'Yes' ? value : null,
        paymentDate,
        client_lat,
        client_lng,
        'Invoice',
        plan.paymentStatus === 'Yes' ? 'paid' : (plan.invoiceStatus === 'Sent' ? 'unpaid' : 'unknown'),
        quoteNum,
        targetDeptId,
        targetCatId,
      ];

      const { rows: inserted } = await client.query(query, values);
      const newId = inserted[0].id;
      createdRenewalIds.push({ id: newId, unique_id, client_name: company.name, service: cat.service, value, status: plan.status });

      // Add audit history for some records
      if (i % 2 === 0) {
        await client.query(`
          INSERT INTO renewal_history (renewal_id, action, previous_data, new_data, performed_by, performed_at)
          VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '${randInt(1, 20)} days')
        `, [
          newId,
          plan.status === 'Renewed' ? 'Confirmed renewal confirmation' : 'Status updated in quarterly review',
          JSON.stringify({ status: 'Active', value: value * 0.95 }),
          JSON.stringify({ status: plan.status, value, remarks: followUpRemarks }),
          owner.id
        ]);
      }

      // Add email log for sent reminders
      if (flags.day_30_sent === 'Yes') {
        await client.query(`
          INSERT INTO email_logs (renewal_id, recipient_email, recipient_type, email_type, subject, status, sent_at, client_name, service)
          VALUES ($1, $2, 'client', 'day_30_reminder', $3, 'sent', NOW() - INTERVAL '${randInt(1, 15)} days', $4, $5)
        `, [
          newId,
          `accounts@${company.domain}`,
          `Upcoming Contract Renewal Reminder - ${cat.service} (${unique_id})`,
          company.name,
          cat.service
        ]);
      }

      // Add notification for records due soon or expired
      if (['Pending Renewal', 'Expired'].includes(plan.status) && i < 10) {
        await client.query(`
          INSERT INTO notifications (user_id, role, title, message, type, read, link, created_at)
          VALUES ($1, 'sales', $2, $3, $4, 0, $5, NOW() - INTERVAL '${randInt(1, 5)} hours')
        `, [
          owner.id,
          plan.status === 'Expired' ? 'Renewal Expired' : 'Renewal Due Soon',
          `${company.name} renewal for ${cat.service} (${unique_id}) requires action.`,
          plan.status === 'Expired' ? 'error' : 'warning',
          `/renewals?search=${encodeURIComponent(company.name)}`
        ]);
      }
    }

    await client.query('COMMIT');
    console.log(`✅ Successfully seeded ${createdRenewalIds.length} renewal records into the database!`);
    return createdRenewalIds;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to seed renewals, transaction rolled back:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed30Dummy.js')) {
  seed30Records()
    .then(records => {
      console.log('\n--- Seeded 30 Records Summary ---');
      const byStatus = {};
      let totalVal = 0;
      records.forEach(r => {
        byStatus[r.status] = (byStatus[r.status] || 0) + 1;
        totalVal += parseFloat(r.value);
      });
      console.log('Status breakdown:');
      for (const [k, v] of Object.entries(byStatus)) {
        console.log(`  - ${k}: ${v}`);
      }
      console.log(`Total Portfolio Value: ₹${totalVal.toLocaleString('en-IN')}`);
      process.exit(0);
    })
    .catch(err => {
      console.error('Fatal seed error:', err);
      process.exit(1);
    });
}
