// Seeds 1,000 realistic, comprehensive dummy renewals + supporting audit history,
// email logs, activity logs, notifications, and field visits for high-impact client demos.
import bcrypt from 'bcryptjs';
import db, { initDb } from './db.js';

const DEMO_USERS = [
  { email: 'admin.demo@marslab.work', full_name: 'Aditi Sharma', role: 'dept_admin', password: 'Demo@1234', avatar_color: '#f59e0b' },
  { email: 'sales.demo1@marslab.work', full_name: 'Rohan Mehta', role: 'user', password: 'Demo@1234', avatar_color: '#3b82f6' },
  { email: 'sales.demo2@marslab.work', full_name: 'Priya Nair', role: 'user', password: 'Demo@1234', avatar_color: '#10b981' },
  { email: 'ranjithkumar.v@marslab.work', full_name: 'Ranjith Kumar', role: 'user', password: 'sales123', avatar_color: '#8b5cf6' },
  { email: 'sakthivel.k@marslab.work', full_name: 'Sakthivel K', role: 'user', password: 'sales123', avatar_color: '#06b6d4' },
  { email: 'sameerulrahman.f@marslab.work', full_name: 'Sameerul Rahman', role: 'super_admin', password: 'admin123', avatar_color: '#ec4899' },
];

const CITIES = [
  { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
  { name: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
  { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
  { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
  { name: 'Pune', lat: 18.5204, lng: 73.8567 },
  { name: 'Coimbatore', lat: 11.0168, lng: 76.9558 },
  { name: 'Delhi NCR', lat: 28.6139, lng: 77.2090 },
  { name: 'Kolkata', lat: 22.5726, lng: 88.3639 },
  { name: 'Kochi', lat: 9.9312, lng: 76.2673 },
  { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
];

const CLIENT_COMPANIES = [
  // Technology & IT Services
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

  // Manufacturing & Heavy Engineering
  { name: 'Aadit Auto Company Pvt Ltd', domain: 'aaditauto.com', person: 'Vikram Doraisamy', city: 'Chennai' },
  { name: 'Sri Balaji Castings Pvt Ltd', domain: 'sbcmail.in', person: 'Sathish Kumar M', city: 'Coimbatore' },
  { name: 'Swelect Energy Systems Limited', domain: 'swelectes.com', person: 'Suresh Babu E', city: 'Salem' },
  { name: 'Swelect HHV Solar Photovoltaics', domain: 'swelectes.com', person: 'Vendhan S A', city: 'Bengaluru' },
  { name: 'Pinnacle Manufacturing Ltd', domain: 'pinnaclemfg.in', person: 'Ramesh Sundaram', city: 'Chennai' },
  { name: 'Ferrous Metals & Alloys Co', domain: 'ferrousmetals.co.in', person: 'Gautam Singhania', city: 'Mumbai' },
  { name: 'Oakridge Constructions Corp', domain: 'oakridgeconstructions.com', person: 'Rajeshwar Reddy', city: 'Hyderabad' },
  { name: 'Kothari Brothers Tech Pvt Ltd', domain: 'kotharibrothers.net', person: 'Sachin Kothari', city: 'Chennai' },
  { name: 'Mahavir Automobiles Ltd', domain: 'mahavirauto.in', person: 'Abhishek Jain', city: 'Chennai' },
  { name: 'Mahavir Motors & Spares', domain: 'mahavirmotors.com', person: 'Bharath Shah', city: 'Coimbatore' },
  { name: 'Sree Vardhaman Autoparts', domain: 'vardhamanauto.in', person: 'Ananda Kumar V', city: 'Chennai' },
  { name: 'Kerala Paper Products Limited', domain: 'kpplonline.in', person: 'Sivagami D', city: 'Kochi' },
  { name: 'S S Green Enviro Metal Impex', domain: 'ssgreenenviro.in', person: 'Sridhar Pandian', city: 'Chennai' },
  { name: 'Apex Precision Engineering Works', domain: 'apexprecision.in', person: 'Kalyanasundaram N', city: 'Coimbatore' },
  { name: 'Titanium Valves & Pumps Pvt Ltd', domain: 'titaniumvalves.com', person: 'Govindarajan R', city: 'Chennai' },
  { name: 'United Steel Forge Works', domain: 'unitedsteelforge.in', person: 'Mohit Agarwal', city: 'Ahmedabad' },
  { name: 'Delta Fluid Controls Pvt Ltd', domain: 'deltafluid.co.in', person: 'Suresh Krishnan', city: 'Pune' },
  { name: 'Everest Industrial Pipes Ltd', domain: 'everestpipes.in', person: 'Sanjay Deshmukh', city: 'Mumbai' },
  { name: 'Krishna Castalloy Technologies', domain: 'krishnacastalloy.com', person: 'Gopalakrishnan V', city: 'Chennai' },
  { name: 'Matrix Hydraulic Cylinders', domain: 'matrixhydraulics.in', person: 'Balaji Padmanabhan', city: 'Bengaluru' },

  // Logistics & Supply Chain
  { name: 'Coral Reef Logistics India', domain: 'coralreefs.in', person: 'Subramanian Swamy', city: 'Kochi' },
  { name: 'Harborline Shipping & Freight', domain: 'harborlineship.com', person: 'Capt. Jude Fernando', city: 'Chennai' },
  { name: 'Meridian Freight Forwarders', domain: 'meridianfreight.in', person: 'Sunil Mathur', city: 'Mumbai' },
  { name: 'Vijay Logistics Solutions', domain: 'vijaylogistics.co.in', person: 'Ananth Padmanabhan', city: 'Chennai' },
  { name: 'SpeedTrans Express Logistics', domain: 'speedtrans.co.in', person: 'Manikandan K', city: 'Coimbatore' },
  { name: 'Coastline Cargo Movers', domain: 'coastlinecargo.in', person: 'Jaganathan V', city: 'Kochi' },
  { name: 'TransContinental Supply Chain', domain: 'transcontinental.in', person: 'Nitin Gadkari', city: 'Mumbai' },
  { name: 'BlueDart Air Partner Logistics', domain: 'airpartnerlogistics.in', person: 'Deepak Chopra', city: 'Delhi NCR' },
  { name: 'Falcon Cold Storage & Supply', domain: 'falconcoldstorage.com', person: 'Pradeep Goel', city: 'Ahmedabad' },
  { name: 'Global Port Agency Services', domain: 'globalportagency.in', person: 'Vigneshwaran P', city: 'Chennai' },

  // Retail, Consumer & FMCG
  { name: 'Sunrise Retail Group India', domain: 'sunriseretail.in', person: 'Jayanthi Sridhar', city: 'Bengaluru' },
  { name: 'Avigna Retail Private Limited', domain: 'avigna.in', person: 'Sampath Kumar S', city: 'Chennai' },
  { name: 'Evergreen Foods & Beverages', domain: 'evergreenfoods.co.in', person: 'Murali Mohan', city: 'Hyderabad' },
  { name: 'Olive Grapes Retail Brand', domain: 'olivegrapes.in', person: 'Arun Kumar V', city: 'Chennai' },
  { name: 'Ravindra Stores Chain Ltd', domain: 'ravindrastores.com', person: 'Amudha Ravindran', city: 'Chennai' },
  { name: 'FreshNest Dairy & Organic Products', domain: 'freshnest.in', person: 'Raghavan S', city: 'Coimbatore' },
  { name: 'Greenfield Organics Pvt Ltd', domain: 'greenfieldorganics.in', person: 'Sowmya Swaminathan', city: 'Bengaluru' },
  { name: 'Heritage Spices & Condiments', domain: 'heritagespices.in', person: 'Krishnamoorthy T', city: 'Kochi' },
  { name: 'UrbanTrends Apparel Fashion', domain: 'urbantrends.in', person: 'Pooja Hegde', city: 'Bengaluru' },
  { name: 'Classic Leather Goods Exporters', domain: 'classicleather.in', person: 'Sirajuddin Ahmed', city: 'Chennai' },

  // Healthcare, Pharma & Biotech
  { name: 'Silverline Pharmaceuticals Ltd', domain: 'silverlinepharma.com', person: 'Dr. Aravind Swaminathan', city: 'Hyderabad' },
  { name: 'Apex Diagnostic Labs Chain', domain: 'apexdiagnostics.in', person: 'Dr. Priya Varma', city: 'Chennai' },
  { name: 'MedVantage Hospitals Group', domain: 'medvantage.in', person: 'Senthil Kumaran', city: 'Bengaluru' },
  { name: 'Sitwanto Devi Mahila Kalyan Sansthan', domain: 'nsmch.in', person: 'Rakesh Kumar Sinha', city: 'Patna' },
  { name: 'BioGenix Lifesciences India', domain: 'biogenixlife.com', person: 'Dr. Madhavan Nair', city: 'Hyderabad' },
  { name: 'CarePlus Multi-Speciality Clinics', domain: 'careplusclinics.in', person: 'Dr. Sudhir Shenoy', city: 'Pune' },
  { name: 'Zenith BioPharma Research', domain: 'zenithbiopharma.in', person: 'Dr. Sunita Rao', city: 'Bengaluru' },
  { name: 'TheraPure Formulations Ltd', domain: 'therapure.co.in', person: 'Venkatesh Babu', city: 'Chennai' },

  // Energy, Infra & Real Estate
  { name: 'Novagrid Energy Solutions', domain: 'novagridenergy.com', person: 'Chirag Parekh', city: 'Ahmedabad' },
  { name: 'Crestpoint Realty Infrastructure', domain: 'crestpointrealty.in', person: 'Manoj Tiwari', city: 'Mumbai' },
  { name: 'Solaris CleanTech Ventures', domain: 'solarisclean.in', person: 'Kishore Biyani', city: 'Bengaluru' },
  { name: 'MetroBuild Contracting LLP', domain: 'metrobuild.co.in', person: 'Surendran Pillai', city: 'Kochi' },
  { name: 'Zenith City Planners & Builders', domain: 'zenithbuilders.in', person: 'Anil Ambani', city: 'Mumbai' },
  { name: 'BlueHorizon Green Energy Ltd', domain: 'bluehorizonenergy.com', person: 'Vijay Mallya', city: 'Bengaluru' },

  // Hospitality & Travel
  { name: 'Lotus Hospitality Group', domain: 'lotushospitality.in', person: 'Tarun Tahiliani', city: 'Chennai' },
  { name: 'Grand Royale Resorts & Spas', domain: 'grandroyaleresorts.com', person: 'Alok Sharma', city: 'Kochi' },
  { name: 'Palazzo Luxury Suites', domain: 'palazzosuites.in', person: 'Natasha Poonawalla', city: 'Mumbai' },
  { name: 'Voyager Business Hotels', domain: 'voyagerhotels.in', person: 'Abhay Deol', city: 'Hyderabad' },

  // Education & Training
  { name: 'BrightPath Education Systems', domain: 'brightpathedu.in', person: 'Prof. Sridharan K', city: 'Chennai' },
  { name: 'St. Jude International Academy', domain: 'stjudeschool.edu.in', person: 'Sister Mary Joseph', city: 'Coimbatore' },
  { name: 'Excelence Global Business School', domain: 'excellencegbs.edu.in', person: 'Dr. Radhakrishnan', city: 'Bengaluru' },
  { name: 'TechSkills Institute of Technology', domain: 'techskills.edu.in', person: 'Gopinath V', city: 'Chennai' },
];

const SERVICE_CATALOG = [
  {
    service: 'MS365',
    vendor: 'Microsoft',
    products: [
      { name: 'MS365 Business Basic', unitBuy: 139, unitSell: 174, desc: 'Cloud mail 50GB, Teams, web apps, OneDrive 1TB' },
      { name: 'MS365 Business Standard', unitBuy: 647, unitSell: 738, desc: 'Full desktop Office apps, Teams, cloud storage 1TB' },
      { name: 'MS365 Business Premium', unitBuy: 1450, unitSell: 1750, desc: 'Standard + Defender for Business, Intune, conditional access' },
      { name: 'MS365 E3 Enterprise', unitBuy: 2400, unitSell: 2850, desc: 'Enterprise mobility, DLP, Windows 11 Enterprise' },
      { name: 'MS365 E5 Enterprise', unitBuy: 3700, unitSell: 4400, desc: 'Advanced compliance, Power BI Pro, Defender XDR' },
      { name: 'Exchange Online Plan 1', unitBuy: 140, unitSell: 180, desc: 'Dedicated 50GB cloud mailbox per user' },
    ],
    minQty: 5, maxQty: 150,
  },
  {
    service: 'GWS',
    vendor: 'Google',
    products: [
      { name: 'Google Workspace Business Starter', unitBuy: 210, unitSell: 270, desc: 'Custom business email, 30GB cloud storage per user, 100-participant video meetings' },
      { name: 'Google Workspace Business Standard', unitBuy: 680, unitSell: 840, desc: 'Custom business email, 2TB pooled storage per user, 150-participant meetings with recording' },
      { name: 'Google Workspace Business Plus', unitBuy: 1300, unitSell: 1650, desc: 'Vault eDiscovery, 5TB pooled storage per user, enhanced security and management' },
      { name: 'Google Workspace Enterprise Plus', unitBuy: 2300, unitSell: 2850, desc: 'Advanced DLP, S/MIME, enterprise endpoint management' },
    ],
    minQty: 5, maxQty: 100,
  },
  {
    service: 'Storage',
    vendor: 'Acronis',
    products: [
      { name: 'Acronis Cyber Protect Cloud 5TB', unitBuy: 10500, unitSell: 15000, desc: '5TB hybrid cloud backup with active ransomware protection and instant restore' },
      { name: 'Acronis Cloud Backup 10TB', unitBuy: 18000, unitSell: 25000, desc: '10TB enterprise cloud backup for servers, VMs, and workstations' },
      { name: 'Acronis Cloud Backup 25TB', unitBuy: 38000, unitSell: 52000, desc: '25TB multi-tier cloud storage with automated compliance archiving' },
      { name: 'AWS S3 Enterprise Storage 50TB', unitBuy: 45000, unitSell: 62000, desc: '50TB Amazon S3 Standard object storage with lifecycle management' },
    ],
    minQty: 1, maxQty: 5,
  },
  {
    service: 'Firewall',
    vendor: 'Sophos',
    products: [
      { name: 'Sophos XGS 116 Next-Gen Firewall', unitBuy: 48000, unitSell: 65000, desc: 'Hardware appliance with Xstream architecture, 1-year Standard Protection license' },
      { name: 'Sophos XGS 2100 Enterprise Firewall', unitBuy: 135000, unitSell: 178000, desc: '1U rackmount next-gen firewall, dual power supply, 1-year Xstream protection' },
      { name: 'Sophos Central Intercept X Advanced', unitBuy: 1800, unitSell: 2400, desc: 'Endpoint protection with deep learning AI and anti-exploit technology' },
      { name: 'Firewall Annual Maintenance AMC', unitBuy: 25000, unitSell: 36000, desc: 'Comprehensive 24x7 hardware and firmware support with 4-hour SLA' },
    ],
    minQty: 1, maxQty: 25,
  },
  {
    service: 'Seqrite',
    vendor: 'Seqrite',
    products: [
      { name: 'Seqrite Endpoint Security Cloud', unitBuy: 735, unitSell: 1107, desc: 'Centralized cloud console, anti-ransomware, firewall, browsing protection' },
      { name: 'Seqrite Endpoint Security Total', unitBuy: 950, unitSell: 1380, desc: 'Total protection with asset management, DLP, and patch management' },
      { name: 'Seqrite HawkkScan Data Privacy', unitBuy: 1400, unitSell: 1950, desc: 'Automated sensitive data discovery and compliance auditing' },
    ],
    minQty: 10, maxQty: 250,
  },
  {
    service: 'SSL',
    vendor: 'Sectigo',
    products: [
      { name: 'Sectigo PositiveSSL Wildcard Certificate', unitBuy: 4500, unitSell: 6800, desc: 'Secures unlimited subdomains with 256-bit encryption and warranty' },
      { name: 'DigiCert EV Multi-Domain SSL', unitBuy: 14500, unitSell: 21000, desc: 'Extended validation green bar certificate with priority verification' },
      { name: 'Sectigo Standard Single-Domain SSL', unitBuy: 1200, unitSell: 2100, desc: 'Domain validated SHA-256 certificate for corporate portals' },
    ],
    minQty: 1, maxQty: 6,
  },
  {
    service: 'Domain',
    vendor: 'Credit Card',
    products: [
      { name: 'Corporate .com Domain Renewal (1 Year)', unitBuy: 850, unitSell: 1550, desc: 'Includes WHOIS privacy protection, DNS management, and SSL auto-bind' },
      { name: 'Corporate .in Domain Renewal (2 Years)', unitBuy: 1150, unitSell: 2200, desc: 'IN Registry official renewal with premium DNS failover' },
      { name: 'Corporate .org Premium Domain (1 Year)', unitBuy: 1100, unitSell: 1850, desc: 'Non-profit and institutional domain renewal with DNSSEC' },
    ],
    minQty: 1, maxQty: 10,
  },
  {
    service: 'Tally',
    vendor: 'Rackbank',
    products: [
      { name: 'Tally Server Cloud (TSC) 5-User Annum', unitBuy: 22000, unitSell: 31100, desc: 'Dedicated cloud VM, 5 concurrent RDP users, automated hourly backups' },
      { name: 'Tally Server Cloud (TSC) 12-User Annum', unitBuy: 54000, unitSell: 80004, desc: 'High-performance cloud server, 12 concurrent users, SSD raid' },
      { name: 'Tally Software Services (TSS) Gold Multi-User', unitBuy: 10800, unitSell: 15500, desc: 'Official Tally Prime Gold multi-user subscription renewal' },
    ],
    minQty: 1, maxQty: 3,
  },
  {
    service: 'Zoho',
    vendor: 'Zoho Corporation',
    products: [
      { name: 'Zoho One All-in-One Enterprise Suite', unitBuy: 18000, unitSell: 24000, desc: 'Complete business operating system with 45+ integrated applications' },
      { name: 'Zoho CRM Professional Edition', unitBuy: 12000, unitSell: 16500, desc: 'Sales pipeline automation, email integration, inventory management' },
      { name: 'Zoho Books & Expense Enterprise', unitBuy: 8500, unitSell: 12500, desc: 'GST compliant accounting, recurring invoicing, and banking feeds' },
    ],
    minQty: 1, maxQty: 10,
  },
  {
    service: 'AWS',
    vendor: 'AWS',
    products: [
      { name: 'AWS EC2 Production Cloud Instance', unitBuy: 32000, unitSell: 45000, desc: 't3.xlarge / c5.xlarge managed cloud computing instance with 99.99% uptime' },
      { name: 'AWS RDS Multi-AZ PostgreSQL Managed', unitBuy: 28000, unitSell: 39000, desc: 'Automated backup, high-availability failover cluster with Read Replica' },
    ],
    minQty: 1, maxQty: 4,
  },
  {
    service: 'AMC',
    vendor: 'MarsLab Technologies',
    products: [
      { name: 'Annual IT Infrastructure AMC', unitBuy: 45000, unitSell: 68000, desc: 'End-to-end onsite & remote hardware, networking, and OS support' },
      { name: 'Server & Cloud Infrastructure 24x7 AMC', unitBuy: 75000, unitSell: 110000, desc: 'Round-the-clock proactive monitoring, security patching, and disaster recovery' },
    ],
    minQty: 1, maxQty: 2,
  },
];

const EXPIRY_REASONS = [
  'Client migrated entirely to GCP infrastructure under global alignment',
  'Severe budget cuts in FY26 following corporate restructuring',
  'Consolidated under parent company enterprise global master contract',
  'Company ceased operations at regional branch office',
  'Client opted for internal open-source self-hosted alternative',
  'Vendor imposed a 40% price hike which was formally rejected by board',
  'Business acquired by competitor; IT stack unified into Microsoft E5',
  'Contract not renewed due to project completion and phased decommission',
];

const FOLLOWUP_REMARKS = [
  'PO received from finance department; license provisioning underway',
  'Client approved revised quotation with 5% multi-year discount',
  'Scheduled in-person meeting with Chief Technology Officer next Tuesday',
  'Awaiting final board approval on annual IT budget allocation',
  'Sent updated invoice and tax residency certificate to accounts payable',
  'Client requested 15-day credit period extension before processing payment',
  'Vendor price revision communicated; client agreed to proceed with renewal',
  'Demonstrated new security features to IT Admin; positive feedback received',
  'Renewal confirmed for 2-year term; commercial invoice issued',
  'Follow-up call completed; decision maker on leave until Monday',
];

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function calculateEmailFlags(daysLeft) {
  return {
    day_30_sent: daysLeft < 30 ? 'Yes' : 'No',
    day_20_sent: daysLeft < 20 ? 'Yes' : 'No',
    day_15_sent: daysLeft < 15 ? 'Yes' : 'No',
    day_10_sent: daysLeft < 10 ? 'Yes' : 'No',
    day_5_sent: daysLeft < 5 ? 'Yes' : 'No',
    day_3_sent: daysLeft < 3 ? 'Yes' : 'No',
    day_0_sent: daysLeft < 0 ? 'Yes' : 'No',
    sales_15_sent: daysLeft < 15 ? 'Yes' : 'No',
    sales_5_sent: daysLeft < 5 ? 'Yes' : 'No',
    sales_3_sent: daysLeft < 3 ? 'Yes' : 'No',
  };
}

// RBAC v2: every demo renewal needs a department_id/category_id, and every
// dept_admin/user demo account needs a matching department_id/category_id —
// otherwise the new scoping in server/utils/scope.js hides all of this data
// from everyone but super_admin. Reuses the Software department that
// initDb() already seeds, and adds one category per SERVICE_CATALOG entry
// (AWS/Microsoft already exist from that seed, ON CONFLICT DO NOTHING skips
// re-creating them).
async function ensureDemoDepartmentAndCategories() {
  const { rows: [dept] } = await db.query("SELECT id FROM departments WHERE slug = 'software-renewals'");
  const categoryIdsByService = {};
  for (const cat of SERVICE_CATALOG) {
    const slug = cat.service.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await db.query(
      `INSERT INTO categories (department_id, name, slug) VALUES ($1, $2, $3)
       ON CONFLICT (department_id, slug) DO NOTHING`,
      [dept.id, cat.service, slug]
    );
    const { rows: [row] } = await db.query(
      'SELECT id FROM categories WHERE department_id = $1 AND slug = $2',
      [dept.id, slug]
    );
    categoryIdsByService[cat.service] = row.id;
  }
  return { departmentId: dept.id, categoryIdsByService };
}

async function seedUsers(departmentId, categoryIdsByService) {
  const idsByEmail = {};
  const userAccounts = DEMO_USERS.filter(u => u.role === 'user');
  const serviceNames = Object.keys(categoryIdsByService);

  for (const u of DEMO_USERS) {
    let deptId = null, catId = null;
    if (u.role === 'dept_admin') {
      deptId = departmentId;
    } else if (u.role === 'user') {
      deptId = departmentId;
      const idx = userAccounts.indexOf(u);
      catId = categoryIdsByService[serviceNames[idx % serviceNames.length]];
    }

    const { rows } = await db.query('SELECT id FROM users WHERE email = $1', [u.email]);
    if (rows.length > 0) {
      idsByEmail[u.email] = rows[0].id;
      // Ensure active
      await db.query('UPDATE users SET is_active = TRUE, full_name = $1, role = $2, avatar_color = $3, department_id = $4, category_id = $5 WHERE id = $6', [
        u.full_name, u.role, u.avatar_color, deptId, catId, rows[0].id
      ]);
      continue;
    }
    const hash = await bcrypt.hash(u.password, 10);
    const username = u.email.split('@')[0];
    const { rows: inserted } = await db.query(
      `INSERT INTO users (username, email, password, full_name, role, avatar_color, is_active, department_id, category_id)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $8) RETURNING id`,
      [username, u.email, hash, u.full_name, u.role, u.avatar_color, deptId, catId]
    );
    idsByEmail[u.email] = inserted[0].id;
    console.log(`  + Seeded user ${u.full_name} <${u.email}> (${u.role})`);
  }
  return idsByEmail;
}

async function seed1000Renewals(idsByEmail, departmentId, categoryIdsByService) {
  console.log('Clearing old renewals and dependent records...');
  await db.query('DELETE FROM visits');
  await db.query('DELETE FROM visit_locations');
  await db.query('DELETE FROM email_logs');
  await db.query('DELETE FROM renewal_history');
  await db.query('DELETE FROM activity_logs');
  await db.query('DELETE FROM notifications');
  await db.query('DELETE FROM renewals');

  console.log('Generating 1,000 realistic dummy renewals...');
  const salesUsers = DEMO_USERS.filter(u => u.role === 'user');
  const allUsers = DEMO_USERS;

  // Distribution plan:
  // 120 Expired (offset -180 to -1 days)
  //   - 85 with expiry_reason
  //   - 35 without expiry_reason (lights up the pending expiry reason widget)
  // 5 Due Today (offset 0 days)
  // 30 Due this week (offset 1 to 7 days)
  // 165 Due this month (offset 8 to 30 days)
  // 530 Active pipeline (offset 31 to 365 days)
  // 150 Renewed contracts (offset -60 to 60 days, status Renewed)
  // Total = 1,000

  const contracts = [];

  // 1. Expired contracts (120)
  for (let i = 0; i < 120; i++) {
    const daysOffset = -randInt(1, 180);
    const hasReason = i < 85;
    contracts.push({
      daysOffset,
      status: 'Expired',
      renewalConfirmation: pick(['cancelled', 'lost', 'service_discontinued', 'pending']),
      expiryReason: hasReason ? pick(EXPIRY_REASONS) : null,
      invoiceStatus: Math.random() < 0.6 ? 'Sent' : 'Not',
      paymentStatus: Math.random() < 0.3 ? 'Yes' : 'No',
    });
  }

  // 2. Due Today (5)
  for (let i = 0; i < 5; i++) {
    contracts.push({
      daysOffset: 0,
      status: 'Pending Renewal',
      renewalConfirmation: pick(['pending', 'reminder_sent', 'quote_sent', 'awaiting_client_approval']),
      expiryReason: null,
      invoiceStatus: 'Sent',
      paymentStatus: 'No',
    });
  }

  // 3. Due this week (30)
  for (let i = 0; i < 30; i++) {
    contracts.push({
      daysOffset: randInt(1, 7),
      status: 'Pending Renewal',
      renewalConfirmation: pick(['pending', 'reminder_sent', 'quote_sent', 'awaiting_client_approval']),
      expiryReason: null,
      invoiceStatus: Math.random() < 0.8 ? 'Sent' : 'Not',
      paymentStatus: Math.random() < 0.2 ? 'Yes' : 'No',
    });
  }

  // 4. Due in 8 to 30 days (165)
  for (let i = 0; i < 165; i++) {
    contracts.push({
      daysOffset: randInt(8, 30),
      status: 'Pending Renewal',
      renewalConfirmation: pick(['pending', 'reminder_sent', 'quote_sent', 'quotation_confirmation', 'awaiting_client_approval']),
      expiryReason: null,
      invoiceStatus: Math.random() < 0.7 ? 'Sent' : 'Not',
      paymentStatus: Math.random() < 0.25 ? 'Yes' : 'No',
    });
  }

  // 5. Active future contracts (530)
  for (let i = 0; i < 530; i++) {
    contracts.push({
      daysOffset: randInt(31, 365),
      status: 'Active',
      renewalConfirmation: 'renewed',
      expiryReason: null,
      invoiceStatus: Math.random() < 0.5 ? 'Sent' : 'Not',
      paymentStatus: Math.random() < 0.4 ? 'Yes' : 'No',
    });
  }

  // 6. Renewed contracts (150)
  for (let i = 0; i < 150; i++) {
    contracts.push({
      daysOffset: randInt(-60, 60),
      status: 'Renewed',
      renewalConfirmation: 'renewed',
      expiryReason: null,
      invoiceStatus: 'Sent',
      paymentStatus: 'Yes',
    });
  }

  // Shuffle contracts array slightly so orders aren't strictly partitioned
  for (let i = contracts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [contracts[i], contracts[j]] = [contracts[j], contracts[i]];
  }

  // Prepare batch insertion
  const renewalIds = [];
  const clientCompanyCount = CLIENT_COMPANIES.length;

  for (let idx = 0; idx < contracts.length; idx++) {
    const item = contracts[idx];
    const unique_id = `RMT-${String(idx + 1).padStart(4, '0')}`;
    const client = CLIENT_COMPANIES[idx % clientCompanyCount];
    const cat = SERVICE_CATALOG[idx % SERVICE_CATALOG.length];
    const prod = cat.products[idx % cat.products.length];
    const owner = salesUsers[idx % salesUsers.length];
    const city = CITIES.find(c => c.name === client.city) || CITIES[idx % CITIES.length];

    // Jitter coordinates slightly around city center (+- 0.05 deg ~ 5km)
    const client_lat = +(city.lat + (Math.random() - 0.5) * 0.08).toFixed(6);
    const client_lng = +(city.lng + (Math.random() - 0.5) * 0.08).toFixed(6);

    const renewal_date = addDays(item.daysOffset);
    const flags = calculateEmailFlags(item.daysOffset);

    // Economics
    const quantity = randInt(cat.minQty, cat.maxQty);
    const purchase_cost = prod.unitBuy;
    // Margins between 18% and 35%
    const margin = 0.18 + (idx % 18) * 0.01;
    const sales_cost = +(purchase_cost * (1 + margin)).toFixed(2);
    const total_purchase = +(purchase_cost * quantity).toFixed(2);
    const total_sales = +(sales_cost * quantity).toFixed(2);
    const value = total_sales;
    const profit = +(total_sales - total_purchase).toFixed(2);

    const invoiceNum = item.invoiceStatus === 'Sent' ? `INV-2026-${String(1001 + idx).padStart(4, '0')}` : null;
    const invoiceDate = item.invoiceStatus === 'Sent' ? addDays(item.daysOffset - randInt(5, 20)) : null;
    const paymentDate = item.paymentStatus === 'Yes' ? addDays(item.daysOffset - randInt(1, 10)) : null;

    const followUpStatus = item.status === 'Renewed' ? 'Completed' : pick([
      'Follow-up Scheduled', 'Quote Under Negotiation', 'PO Awaited', 'Client Agreed - Processing', 'Contacted Decision Maker'
    ]);
    const followUpRemarks = item.status === 'Renewed' ? 'Renewal completed and confirmed.' : pick(FOLLOWUP_REMARKS);

    const planPeriod = pick(['yearly_plan', 'yearly_plan', 'yearly_plan', 'monthly_plan', 'quarterly_plan']);

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

    const quoteNum = `QT-2026-${String(1001 + idx).padStart(4, '0')}`;

    const values = [
      unique_id,
      client.name,
      cat.service,
      renewal_date,
      value,
      owner.full_name,
      `accounts@${client.domain}`,
      owner.email,
      `+91 ${randInt(97000, 99999)} ${randInt(10000, 99999)}`,
      `REF-${String(1000 + idx)}`,
      item.status,
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
      item.renewalConfirmation,
      null, // edit_status
      null, // edit_reason
      item.expiryReason,
      item.invoiceStatus,
      invoiceNum,
      invoiceNum ? value : null,
      invoiceDate,
      planPeriod,
      planPeriod === 'yearly_plan' ? 1 : (planPeriod === 'monthly_plan' ? 12 : 4),
      prod.name,
      `${prod.desc} for ${client.name}`,
      quantity,
      purchase_cost,
      total_purchase,
      sales_cost,
      total_sales,
      profit,
      cat.vendor,
      'MarsLab Technologies',
      idsByEmail[owner.email] || null,
      false,
      item.paymentStatus,
      item.paymentStatus === 'Yes' ? value : null,
      paymentDate,
      client_lat,
      client_lng,
      'Invoice',
      item.paymentStatus === 'Yes' ? 'paid' : (item.invoiceStatus === 'Sent' ? 'pending' : 'unknown'),
      quoteNum,
      departmentId,
      categoryIdsByService[cat.service],
    ];

    const { rows } = await db.query(query, values);
    renewalIds.push({
      id: rows[0].id,
      unique_id,
      client_name: client.name,
      service: cat.service,
      owner_name: owner.full_name,
      owner_id: idsByEmail[owner.email],
      value,
      profit,
      status: item.status,
      lat: client_lat,
      lng: client_lng,
    });

    if ((idx + 1) % 200 === 0) {
      console.log(`  ... inserted ${idx + 1} / 1000 renewals`);
    }
  }

  console.log('1,000 renewals created successfully.');
  return renewalIds;
}

async function seedComplementaryData(renewalIds, idsByEmail) {
  console.log('Seeding complementary audit history, email logs, activity logs, notifications, and field visits...');
  const adminId = idsByEmail['admin.demo@marslab.work'];
  const rohanId = idsByEmail['sales.demo1@marslab.work'];
  const priyaId = idsByEmail['sales.demo2@marslab.work'];

  // 1. Audit Trail (renewal_history) for 180 renewals
  for (let i = 0; i < 180; i++) {
    const ren = renewalIds[i * 5];
    const performer = (i % 2 === 0 ? rohanId : priyaId) || adminId;
    await db.query(`
      INSERT INTO renewal_history (renewal_id, action, previous_data, new_data, performed_by, performed_at)
      VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '${randInt(1, 45)} days')
    `, [
      ren.id,
      pick(['Updated commercial quote', 'Status transitioned to Pending Renewal', 'Client requested revised quotation', 'Confirmed renewal confirmation', 'Logged follow-up call with IT Director']),
      JSON.stringify({ status: 'Active', value: ren.value * 0.95 }),
      JSON.stringify({ status: ren.status, value: ren.value, follow_up: 'Completed' }),
      performer
    ]);
  }

  // 2. Email logs (automated ladder reminders) for 150 renewals
  for (let i = 0; i < 150; i++) {
    const ren = renewalIds[i * 6];
    const daysAgo = randInt(1, 30);
    await db.query(`
      INSERT INTO email_logs (renewal_id, recipient_email, recipient_type, email_type, subject, status, sent_at, client_name, service)
      VALUES ($1, $2, $3, $4, $5, 'sent', NOW() - INTERVAL '${daysAgo} days', $6, $7)
    `, [
      ren.id,
      `accounts@${ren.client_name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      pick(['client', 'sales']),
      pick(['day_30_reminder', 'day_15_reminder', 'day_5_reminder', 'quote_attachment', 'expiry_warning']),
      `Upcoming Contract Renewal Reminder - ${ren.service} (${ren.unique_id})`,
      ren.client_name,
      ren.service
    ]);
  }

  // 3. Activity logs for 120 actions
  for (let i = 0; i < 120; i++) {
    const ren = renewalIds[i * 8];
    const user = pick(DEMO_USERS);
    const userId = idsByEmail[user.email];
    await db.query(`
      INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address, created_at)
      VALUES ($1, $2, $3, $4, $5, '192.168.1.10', NOW() - INTERVAL '${randInt(1, 60)} days')
    `, [
      userId,
      pick(['VIEW_RENEWAL', 'UPDATE_RENEWAL', 'EXPORT_REPORT', 'GENERATE_INVOICE', 'SEND_REMINDER_LADDER', 'CHECK_IN_VISIT']),
      'renewal',
      ren.unique_id,
      `User ${user.full_name} performed action on ${ren.client_name} (${ren.service})`
    ]);
  }

  // 4. In-App Notifications for urgent action items (25)
  for (let i = 0; i < 25; i++) {
    const ren = renewalIds[i * 20];
    await db.query(`
      INSERT INTO notifications (user_id, role, title, message, type, link, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW() - INTERVAL '${randInt(1, 7)} days')
    `, [
      null,
      pick(['admin', 'sales']),
      `Urgent Renewal Action: ${ren.client_name}`,
      `Contract for ${ren.service} (${ren.unique_id}) valued at ₹${ren.value.toLocaleString('en-IN')} requires immediate attention.`,
      pick(['warning', 'info', 'success']),
      `/renewals/${ren.id}`
    ]);
  }

  // 5. Field Visits (15)
  for (let i = 0; i < 15; i++) {
    const ren = renewalIds[i * 50];
    const cstId = (i % 2 === 0 ? rohanId : priyaId) || adminId;
    const isCompleted = i > 3;
    const { rows: visitRows } = await db.query(`
      INSERT INTO visits (
        renewal_id, cst_id, status, start_time, arrival_time, check_in_time, check_out_time,
        start_latitude, start_longitude, client_reached, arrival_latitude, arrival_longitude, arrival_distance_meters,
        notes, photo_data
      ) VALUES (
        $1, $2, $3,
        NOW() - INTERVAL '${i * 2 + 1} days 4 hours',
        NOW() - INTERVAL '${i * 2 + 1} days 3 hours 30 mins',
        NOW() - INTERVAL '${i * 2 + 1} days 3 hours 25 mins',
        ${isCompleted ? `NOW() - INTERVAL '${i * 2 + 1} days 2 hours'` : 'NULL'},
        $4, $5, true, $6, $7, $8, $9, NULL
      ) RETURNING id
    `, [
      ren.id,
      cstId,
      isCompleted ? 'completed' : 'checked_in',
      ren.lat - 0.012, ren.lng - 0.015,
      ren.lat, ren.lng,
      randInt(12, 85),
      `Met with IT infrastructure team at ${ren.client_name}. Discussed renewal scope for ${ren.service} and upcoming cloud migration plans.`
    ]);

    const visitId = visitRows[0].id;
    // Add breadcrumb locations
    for (let b = 0; b < 5; b++) {
      await db.query(`
        INSERT INTO visit_locations (visit_id, latitude, longitude, accuracy, captured_at)
        VALUES ($1, $2, $3, $4, NOW() - INTERVAL '${i * 2 + 1} days ${4 - b * 0.15} hours')
      `, [
        visitId,
        ren.lat - 0.012 + (b * 0.0024),
        ren.lng - 0.015 + (b * 0.003),
        randInt(5, 15)
      ]);
    }
  }

  console.log('Complementary audit trails, emails, logs, notifications, and visits seeded.');
}

async function main() {
  // SECURITY: this creates real-looking @marslab.work accounts with weak,
  // committed passwords (Demo@1234, sales123, admin123). Refuse to run
  // against a production database — the only thing standing between this
  // and live credentials on the real system was remembering not to run it.
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run: NODE_ENV=production. This seeds demo accounts with weak, publicly-committed passwords.');
    process.exit(1);
  }
  await initDb();
  console.log('=== SEEDING 1,000 DUMMY RECORDS FOR CLIENT DEMO ===');
  const { departmentId, categoryIdsByService } = await ensureDemoDepartmentAndCategories();
  const idsByEmail = await seedUsers(departmentId, categoryIdsByService);
  const renewalIds = await seed1000Renewals(idsByEmail, departmentId, categoryIdsByService);
  await seedComplementaryData(renewalIds, idsByEmail);

  // Summary counts
  const total = await db.query('SELECT COUNT(*) FROM renewals');
  const statusCounts = await db.query('SELECT status, COUNT(*) FROM renewals GROUP BY status ORDER BY count DESC');
  const sumVal = await db.query('SELECT SUM(value) as val, SUM(profit) as prof FROM renewals');

  console.log('\n=== SEEDING COMPLETE ===');
  console.log(`Total Renewals: ${total.rows[0].count}`);
  console.log('Status Breakdown:');
  for (const s of statusCounts.rows) {
    console.log(`  - ${s.status.padEnd(16)}: ${s.count}`);
  }
  console.log(`Total Pipeline Value: ₹${parseFloat(sumVal.rows[0].val).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
  console.log(`Total Profit:         ₹${parseFloat(sumVal.rows[0].prof).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
  console.log('\nReady for demo! Login with Quick Demo Login or:');
  for (const u of DEMO_USERS) {
    console.log(`  ${u.role.padEnd(6)} ${u.email} / ${u.password}`);
  }
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});
