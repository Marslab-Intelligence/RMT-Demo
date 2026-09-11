import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const ARTIFACTS_DIR = '/home/sameer/.gemini/antigravity-ide/brain/a5288db8-a647-4d0b-b7ac-854ee380001b';
const BASE_URL = 'http://localhost:3001';

async function run() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

  async function loginAsRole(matchText) {
    console.log(`Logging in matching '${matchText}'...`);
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1000));
    const demoButtons = await page.$$('button');
    let clicked = false;
    for (const b of demoButtons) {
      const text = await page.evaluate(el => el.textContent, b);
      if (text.includes(matchText)) {
        await b.click();
        clicked = true;
        break;
      }
    }
    if (!clicked) {
      console.warn(`Button with '${matchText}' not found, clicking first demo button`);
      await page.click('button[class*="flex items-center gap-3"]');
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  async function setTheme(mode) {
    await page.evaluate((isDark) => {
      if (isDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    }, mode === 'dark');
    await new Promise(r => setTimeout(r, 400));
  }

  async function capture(urlPath, filename, theme = 'light') {
    await page.goto(`${BASE_URL}${urlPath}`, { waitUntil: 'domcontentloaded' });
    await setTheme(theme);
    await new Promise(r => setTimeout(r, 1500));
    const fullPath = path.join(ARTIFACTS_DIR, filename);
    await page.screenshot({ path: fullPath, fullPage: false });
    console.log(`Saved: ${filename}`);
  }

  try {
    console.log('1. Super Admin Profile: Activity Logs, Pricing, Analytics, Dashboard...');
    await loginAsRole('Sameerul Rahman');
    await capture('/activity-logs', 'qa_fullwidth_activity_logs_light.png', 'light');
    await capture('/activity-logs', 'qa_fullwidth_activity_logs_dark.png', 'dark');
    await capture('/pricing', 'qa_fullwidth_pricing_light.png', 'light');
    await capture('/analytics', 'qa_fullwidth_analytics_light.png', 'light');
    await capture('/', 'qa_fullwidth_superadmin_dashboard_light.png', 'light');
    await capture('/renewals', 'qa_fullwidth_renewals_light.png', 'light');

    console.log('2. CEO Profile: Executive Dashboard...');
    await loginAsRole('Executive Leadership');
    await capture('/ceo/dashboard', 'qa_fullwidth_ceo_dashboard_light.png', 'light');
    await capture('/ceo/dashboard', 'qa_fullwidth_ceo_dashboard_dark.png', 'dark');

    console.log('3. Dept Admin Profile: Dashboard...');
    await loginAsRole('Aditi Sharma');
    await capture('/', 'qa_fullwidth_deptadmin_dashboard_light.png', 'light');

    console.log('All full-width verification captures complete!');
  } catch (err) {
    console.error('QA capture failed:', err);
  } finally {
    await browser.close();
  }
}

run();
