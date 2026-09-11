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
    const clicked = await page.evaluate((targetName) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent && b.textContent.includes(targetName));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    }, name);
    console.log(`Clicked login for ${name}: ${clicked}`);
    await new Promise(r => setTimeout(r, 1500));
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
    await new Promise(r => setTimeout(r, 500));
  }

  async function capture(urlPath, filename, theme = 'dark') {
    if (page.url() !== `${BASE_URL}${urlPath}`) {
      await page.goto(`${BASE_URL}${urlPath}`, { waitUntil: 'domcontentloaded' });
    }
    await new Promise(r => setTimeout(r, 1200));
    await setTheme(theme);
    const fullPath = path.join(ARTIFACTS_DIR, filename);
    await page.screenshot({ path: fullPath, fullPage: false });
    console.log(`Saved screenshot: ${filename} (URL: ${page.url()})`);
  }

  try {
    console.log('1. CEO Session...');
    await loginAsName('Executive Leadership');
    await capture('/ceo/dashboard', 'qa_ceo_dashboard_dark.png', 'dark');
    await capture('/ceo/dashboard', 'qa_ceo_dashboard_light.png', 'light');
    await capture('/ceo/vendors', 'qa_ceo_vendors_dark.png', 'dark');
    await capture('/ceo/vendors', 'qa_ceo_vendors_light.png', 'light');

    console.log('2. Super Admin Session...');
    await loginAsName('Sameerul Rahman');
    await capture('/', 'qa_superadmin_dashboard_dark.png', 'dark');
    await capture('/', 'qa_superadmin_dashboard_light.png', 'light');
    await capture('/activity-logs', 'qa_activity_logs_dark.png', 'dark');
    await capture('/activity-logs', 'qa_activity_logs_light.png', 'light');
    await capture('/pricing', 'qa_pricing_dark.png', 'dark');
    await capture('/pricing', 'qa_pricing_light.png', 'light');

    console.log('3. Department Admin Session...');
    await loginAsName('Aditi Sharma');
    await capture('/', 'qa_deptadmin_dashboard_dark.png', 'dark');
    await capture('/', 'qa_deptadmin_dashboard_light.png', 'light');

    console.log('4. Specialist User Session...');
    await loginAsName('Priya Nair');
    await capture('/', 'qa_user_dashboard_dark.png', 'dark');
    await capture('/', 'qa_user_dashboard_light.png', 'light');

    console.log('All QA screenshots captured successfully via interactive login!');
  } catch (err) {
    console.error('QA capture error:', err);
  } finally {
    await browser.close();
  }
}

run();
