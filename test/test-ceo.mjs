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

    console.log('1. Navigating to login page...');
    await page.goto('http://localhost:3001/login', { waitUntil: 'domcontentloaded' });

    console.log('2. Clicking CEO Quick Demo Login...');
    await page.waitForSelector('button', { timeout: 10000 });
    
    // Find button containing "Executive Leadership" or "ceo.demo@marslab.work"
    const buttons = await page.$$('button');
    let clicked = false;
    for (const b of buttons) {
      const text = await page.evaluate(el => el.innerText, b);
      if (text.includes('Executive Leadership') || text.includes('ceo.demo@marslab.work')) {
        await Promise.all([
          b.click(),
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {}),
        ]);
        clicked = true;
        console.log('Clicked CEO demo button successfully.');
        break;
      }
    }

    if (!clicked) {
      throw new Error('Could not find CEO demo login button!');
    }

    await new Promise(r => setTimeout(r, 2000));
    const currentUrl = page.url();
    console.log('3. Redirected to URL:', currentUrl);

    if (!currentUrl.includes('/ceo/dashboard')) {
      throw new Error(`Expected redirect to /ceo/dashboard but got: ${currentUrl}`);
    }

    // Capture screenshot of Redesigned CEO Dashboard
    const dashPath = path.join(outDir, 'ceo_dashboard_redesign.png');
    await page.screenshot({ path: dashPath, fullPage: true });
    console.log('4. Captured Redesigned CEO Dashboard screenshot:', dashPath);

    // Test Navigation to /ceo/health
    console.log('5. Navigating to Company Health Deep-Dive (/ceo/health)...');
    await page.goto('http://localhost:3001/ceo/health', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1500));
    const healthPath = path.join(outDir, 'ceo_health_deepdive_page.png');
    await page.screenshot({ path: healthPath, fullPage: true });
    console.log('Captured CEO Health Deep-Dive screenshot:', healthPath);

    // Test in-app Back button on /ceo/health
    console.log('6. Testing in-app Back button on /ceo/health...');
    const pageButtons = await page.$$('button');
    let backClicked = false;
    for (const b of pageButtons) {
      const text = await page.evaluate(el => el.innerText, b);
      if (text.includes('Back to Executive Overview')) {
        await b.click();
        backClicked = true;
        console.log('Clicked Back to Executive Overview button on /ceo/health.');
        break;
      }
    }
    if (!backClicked) {
      throw new Error('Could not find Back to Executive Overview button on /ceo/health!');
    }
    await new Promise(r => setTimeout(r, 1500));
    console.log('URL after clicking Back:', page.url());
    if (!page.url().includes('/ceo/dashboard')) {
      throw new Error(`Expected /ceo/dashboard after back click, but got: ${page.url()}`);
    }

    // Helper to click sidebar nav
    async function clickNav(name) {
      const links = await page.$$('aside a');
      for (const link of links) {
        const text = await page.evaluate(el => el.innerText, link);
        if (text.includes(name)) {
          await link.click();
          await new Promise(r => setTimeout(r, 2000));
          return true;
        }
      }
      return false;
    }

    // Test Departments Page & Drawer Back Navigation
    console.log('7. Navigating to Departments via sidebar...');
    await clickNav('Departments');
    const deptsPath = path.join(outDir, 'ceo_departments_page_redesign.png');
    await page.screenshot({ path: deptsPath, fullPage: true });
    console.log('Captured CEO Departments screenshot:', deptsPath);

    // Click top department card to open drill-down drawer
    console.log('8. Testing drill-down drawer with back navigation...');
    const deptCards = await page.$$('div[class*="cursor-pointer"]');
    if (deptCards.length > 0) {
      await deptCards[0].click();
      await new Promise(r => setTimeout(r, 1500));
      const drawerPath = path.join(outDir, 'ceo_drawer_back_navigation.png');
      await page.screenshot({ path: drawerPath, fullPage: false });
      console.log('Captured Executive Detail Drawer screenshot:', drawerPath);

      // Close drawer
      const closeBtn = await page.$('button[title="Close drawer"], button[title="Close"]');
      if (closeBtn) {
        await closeBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
      await new Promise(r => setTimeout(r, 800));
    }

    // Test Vendors Page
    console.log('9. Navigating to Vendors via sidebar...');
    await clickNav('Vendors');
    const vendorsPath = path.join(outDir, 'ceo_vendors_page_redesign.png');
    await page.screenshot({ path: vendorsPath, fullPage: true });
    console.log('Captured CEO Vendors screenshot:', vendorsPath);

    // Test Renewals Page
    console.log('10. Navigating to Renewals via sidebar...');
    await clickNav('Renewals');
    const renewalsPath = path.join(outDir, 'ceo_renewals_page_redesign.png');
    await page.screenshot({ path: renewalsPath, fullPage: true });
    console.log('Captured CEO Renewals screenshot:', renewalsPath);

    // Test Reports Page
    console.log('11. Navigating to Reports via sidebar...');
    await clickNav('Reports');
    const reportsPath = path.join(outDir, 'ceo_reports_page_redesign.png');
    await page.screenshot({ path: reportsPath, fullPage: true });
    console.log('Captured CEO Reports screenshot:', reportsPath);

    console.log('ALL CEO BROWSER WORKFLOW TESTS PASSED!');
  } catch (err) {
    console.error('Error during test:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

run();
