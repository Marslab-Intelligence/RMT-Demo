import puppeteer from 'puppeteer';
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

  try {
    console.log('Logging in as Super Admin...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1000));
    const demoButtons = await page.$$('button');
    for (const b of demoButtons) {
      const text = await page.evaluate(el => el.textContent, b);
      if (text.includes('Sameerul Rahman') || text.includes('SUPER_ADMIN')) {
        await b.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 1500));

    console.log('Navigating to /activity-logs...');
    await page.goto(`${BASE_URL}/activity-logs`, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1500));

    // Ensure Light mode
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    });
    await new Promise(r => setTimeout(r, 500));

    // Capture initial single-page view with scroll buttons visible
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'qa_activity_stream_singlepage_light.png'),
      fullPage: false
    });
    console.log('Saved: qa_activity_stream_singlepage_light.png');

    // Click Down button to scroll over the list
    console.log('Clicking scroll Down button...');
    const downButtons = await page.$$('button[aria-label="Scroll down"]');
    if (downButtons.length > 0) {
      await downButtons[0].click();
      await new Promise(r => setTimeout(r, 800));
      await downButtons[0].click();
      await new Promise(r => setTimeout(r, 800));
    }

    // Capture scrolled state
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'qa_activity_stream_scrolled_light.png'),
      fullPage: false
    });
    console.log('Saved: qa_activity_stream_scrolled_light.png');

    // Capture Dark mode as well
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'qa_activity_stream_singlepage_dark.png'),
      fullPage: false
    });
    console.log('Saved: qa_activity_stream_singlepage_dark.png');

    console.log('All verification captures complete!');
  } catch (err) {
    console.error('QA stream scroll failed:', err);
  } finally {
    await browser.close();
  }
}

run();
