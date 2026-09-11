import puppeteer from 'puppeteer';
import path from 'path';

const ARTIFACTS_DIR = '/home/sameer/.gemini/antigravity-ide/brain/a5288db8-a647-4d0b-b7ac-854ee380001b';
const BASE_URL = 'http://localhost:3001';

async function run() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  async function loginAsName(name) {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button');
    await new Promise(r => setTimeout(r, 400));
    await page.evaluate((targetName) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent && b.textContent.includes(targetName));
      if (btn) btn.click();
    }, name);
    await new Promise(r => setTimeout(r, 1500));
  }

  async function capture(filename) {
    const fullPath = path.join(ARTIFACTS_DIR, filename);
    await page.screenshot({ path: fullPath, fullPage: false });
    console.log(`Saved screenshot: ${filename}`);
  }

  try {
    console.log('1. Logging in as Super Admin (Sameerul Rahman)...');
    await loginAsName('Sameerul Rahman');

    console.log('2. Navigating to /analytics...');
    await page.goto(`${BASE_URL}/analytics`, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1200));
    await capture('qa_analytics_tab_overview.png');

    console.log('3. Clicking Cross-Department Comparison tab...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent && b.textContent.includes('Cross-Department Comparison'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 800));
    await capture('qa_analytics_tab_comparison.png');

    console.log('4. Clicking Vendor Concentration tab...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent && b.textContent.includes('Vendor Concentration'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 800));
    await capture('qa_analytics_tab_vendors.png');

    console.log('5. Clicking a vendor to open Vendor Detail Drawer...');
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr, div[class*="cursor-pointer"]'));
      const sophosRow = rows.find(r => r.textContent && r.textContent.includes('Sophos'));
      if (sophosRow) sophosRow.click();
    });
    await new Promise(r => setTimeout(r, 800));
    await capture('qa_analytics_vendor_drawer.png');

    // Close vendor drawer
    await page.evaluate(() => {
      const closeBtn = document.querySelector('button svg.lucide-x')?.parentElement;
      if (closeBtn) closeBtn.click();
    });
    await new Promise(r => setTimeout(r, 400));

    console.log('6. Clicking Company Leaderboard tab...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent && b.textContent.includes('Company Leaderboard'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 800));
    await capture('qa_analytics_tab_leaderboard.png');

    console.log('7. Switching back to comparison tab and drilling into Software Renewals...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent && b.textContent.includes('Cross-Department Comparison'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      const softwareRow = rows.find(r => r.textContent && r.textContent.includes('Software Renewals'));
      if (softwareRow) softwareRow.click();
    });
    await new Promise(r => setTimeout(r, 1200));
    await capture('qa_analytics_dept_detail.png');

    console.log('8. Clicking Revenue at Risk sub-tab inside department...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const riskBtn = buttons.find(b => b.textContent && b.textContent.includes('Revenue at Risk'));
      if (riskBtn) riskBtn.click();
    });
    await new Promise(r => setTimeout(r, 800));
    await capture('qa_analytics_dept_risk_tab.png');

    console.log('9. Clicking Back to All Tabs...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const backBtn = buttons.find(b => b.textContent && b.textContent.includes('Back to All Tabs'));
      if (backBtn) backBtn.click();
    });
    await new Promise(r => setTimeout(r, 800));
    await capture('qa_analytics_back_to_tabs.png');

    console.log('All tab tests and captures completed successfully!');
  } catch (err) {
    console.error('QA tab capture error:', err);
  } finally {
    await browser.close();
  }
}

run();
