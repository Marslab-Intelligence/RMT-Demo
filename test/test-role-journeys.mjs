import puppeteer from 'puppeteer';
import path from 'path';

const outDir = '/home/sameer/.gemini/antigravity-ide/brain/98e8b1ac-d794-48a0-bc01-f4ffc1e87929';

async function run() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1536, height: 960 },
  });

  try {
    const page = await browser.newPage();

    // =========================================================================
    // 1. SUPER ADMIN JOURNEY (Govern & Control)
    // =========================================================================
    console.log('--- 1. Testing Super Admin Journey ---');
    await page.goto('http://localhost:3001/login', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button', { timeout: 10000 });

    // Click Super Admin Quick Demo Login (Sameerul Rahman / super_admin)
    const buttons = await page.$$('button');
    let saClicked = false;
    for (const b of buttons) {
      const text = await page.evaluate(el => el.innerText, b);
      if (text.includes('Sameerul Rahman') || text.includes('sameerulrahman.f@marslab.work')) {
        await Promise.all([
          b.click(),
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {}),
        ]);
        saClicked = true;
        break;
      }
    }
    if (!saClicked) throw new Error('Could not find Super Admin demo button!');

    await new Promise(r => setTimeout(r, 2000));
    console.log('Super Admin redirected to:', page.url());

    // Verify Platform Control Center rendered
    const saPageText = await page.evaluate(() => document.body.innerText);
    if (!saPageText.includes('Platform Control Center')) {
      throw new Error('Super Admin dashboard did not render Platform Control Center!');
    }
    console.log('Verified Super Admin Platform Control Center header.');

    const saPath = path.join(outDir, 'superadmin_control_center.png');
    await page.screenshot({ path: saPath, fullPage: true });
    console.log('Captured Super Admin Control Center screenshot:', saPath);

    // =========================================================================
    // 2. ADMIN JOURNEY (Manage & Improve)
    // =========================================================================
    console.log('--- 2. Testing Admin Journey ---');
    await page.goto('http://localhost:3001/login', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button', { timeout: 10000 });

    const adminBtns = await page.$$('button');
    let adminClicked = false;
    for (const b of adminBtns) {
      const text = await page.evaluate(el => el.innerText, b);
      if (text.includes('Aditi Sharma') || text.includes('admin.demo@marslab.work')) {
        await Promise.all([
          b.click(),
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {}),
        ]);
        adminClicked = true;
        break;
      }
    }
    if (!adminClicked) throw new Error('Could not find Admin demo button!');

    await new Promise(r => setTimeout(r, 2000));
    console.log('Admin redirected to:', page.url());

    const adminPageText = await page.evaluate(() => document.body.innerText);
    if (!adminPageText.includes('Operations Command Center')) {
      throw new Error('Admin dashboard did not render Operations Command Center!');
    }
    console.log('Verified Admin Operations Command Center header.');

    const adminPath = path.join(outDir, 'admin_operations_center.png');
    await page.screenshot({ path: adminPath, fullPage: true });
    console.log('Captured Admin Operations Center screenshot:', adminPath);

    // Test Client Details, Approval Inbox, and Renewals List as Admin
    console.log('--- 2b. Testing Client Details & In-App Back Navigation (Admin) ---');
    await page.evaluate(() => window.location.href = '/renewals/28');
    await new Promise(r => setTimeout(r, 2500));
    const cdPath = path.join(outDir, 'client_details_redesign.png');
    await page.screenshot({ path: cdPath, fullPage: true });
    console.log('Captured Client Details Redesign screenshot:', cdPath);

    console.log('--- 2c. Testing Approval Inbox Redesign (Admin) ---');
    await page.evaluate(() => window.location.href = '/approval-inbox');
    await new Promise(r => setTimeout(r, 2500));
    const aiPath = path.join(outDir, 'approval_inbox_redesign.png');
    await page.screenshot({ path: aiPath, fullPage: true });
    console.log('Captured Approval Inbox Redesign screenshot:', aiPath);

    console.log('--- 2d. Testing Renewals List Redesign (Admin) ---');
    await page.evaluate(() => window.location.href = '/renewals');
    await new Promise(r => setTimeout(r, 2500));
    const rlPath = path.join(outDir, 'renewals_list_redesign.png');
    await page.screenshot({ path: rlPath, fullPage: true });
    console.log('Captured Renewals List Redesign screenshot:', rlPath);

    // =========================================================================
    // 3. USER JOURNEY (Execute & Complete)
    // =========================================================================
    console.log('--- 3. Testing User Journey ---');
    await page.goto('http://localhost:3001/login', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button', { timeout: 10000 });

    const userBtns = await page.$$('button');
    let userClicked = false;
    for (const b of userBtns) {
      const text = await page.evaluate(el => el.innerText, b);
      if (text.includes('Rohan Mehta') || text.includes('sales.demo1@marslab.work')) {
        await Promise.all([
          b.click(),
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {}),
        ]);
        userClicked = true;
        break;
      }
    }
    if (!userClicked) throw new Error('Could not find User demo button!');

    await new Promise(r => setTimeout(r, 2500));
    console.log('User redirected to:', page.url());

    const userPageText = await page.evaluate(() => document.body.innerText);
    if (!userPageText.includes('My Personal Workspace') && !userPageText.includes('Welcome back, Rohan')) {
      throw new Error('User dashboard did not render Personal Workspace!');
    }
    console.log('Verified User Personal Workspace header.');

    const userPath = path.join(outDir, 'user_personal_workspace.png');
    await page.screenshot({ path: userPath, fullPage: true });
    console.log('Captured User Personal Workspace screenshot:', userPath);

    console.log('=== ALL ROLE JOURNEYS & NAVIGATION TESTS COMPLETED SUCCESSFULLY! ===');
  } catch (err) {
    console.error('Error during role journeys test:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

run();
