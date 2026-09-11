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

  try {
    console.log('Navigating to login page...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1000));

    // Click on Quick Demo Login button for Super Admin
    console.log('Clicking Quick Demo Login for Super Admin...');
    const demoButtons = await page.$$('button');
    let clicked = false;
    for (const b of demoButtons) {
      const text = await page.evaluate(el => el.textContent, b);
      if (text.includes('SUPER_ADMIN') || text.includes('Sameerul Rahman')) {
        await b.click();
        clicked = true;
        break;
      }
    }
    if (!clicked) {
      console.warn('Super Admin button not found, clicking first demo button');
      await page.click('button[class*="flex items-center gap-3"]');
    }

    await new Promise(r => setTimeout(r, 2000));

    // Ensure Light Mode first
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    });

    // Navigate to /pricing
    console.log('Navigating to /pricing...');
    await page.goto(`${BASE_URL}/pricing`, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2000));

    // 1. Capture Light Mode Pricing Page Overview
    console.log('1. Capturing Light Mode Pricing Page...');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'qa_pricing_redesigned_light.png'), fullPage: false });

    // 2. Scroll to Charts
    console.log('2. Capturing Light Mode Charts...');
    await page.evaluate(() => {
      const m = document.querySelector('main');
      if (m) m.scrollBy(0, 500);
    });
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'qa_pricing_charts_light.png'), fullPage: false });

    // 3. Switch to Margin % Ranking chart mode
    console.log('3. Switching to Margin % Ranking...');
    const buttons = await page.$$('button');
    for (const b of buttons) {
      const text = await page.evaluate(el => el.textContent, b);
      if (text.includes('Margin % Ranking')) {
        await b.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'qa_pricing_margin_ranking_light.png'), fullPage: false });

    // 4. Switch View Mode to "Product Cards"
    console.log('4. Switching to Product Cards...');
    const buttonsCards = await page.$$('button');
    for (const b of buttonsCards) {
      const text = await page.evaluate(el => el.textContent, b);
      if (text.includes('Product Cards')) {
        await b.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 800));
    await page.evaluate(() => {
      const m = document.querySelector('main');
      if (m) m.scrollBy(0, 400);
    });
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'qa_pricing_cards_view_light.png'), fullPage: false });

    // 4b. Switch View Mode to "Catalog Table"
    console.log('4b. Switching to Catalog Table...');
    const buttonsTable = await page.$$('button');
    for (const b of buttonsTable) {
      const text = await page.evaluate(el => el.textContent, b);
      if (text.includes('Catalog Table')) {
        await b.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 800));
    await page.evaluate(() => {
      const m = document.querySelector('main');
      if (m) m.scrollBy(0, 350);
    });
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'qa_pricing_table_view_light.png'), fullPage: false });

    // 5. Scroll to top and open Add Product Pricing modal with live calculator
    console.log('5. Capturing Add Product Modal...');
    await page.evaluate(() => {
      const m = document.querySelector('main');
      if (m) m.scrollTo(0, 0);
    });
    await new Promise(r => setTimeout(r, 500));
    const allBtns = await page.$$('button');
    for (const b of allBtns) {
      const text = await page.evaluate(el => el.textContent, b);
      if (text.includes('Add Product Pricing')) {
        await b.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 800));
    const inputs = await page.$$('div.modal-glass input[type="number"]');
    if (inputs.length >= 3) {
      await inputs[0].type('4200');
      await inputs[1].type('6000');
      await inputs[2].type('6500');
      await new Promise(r => setTimeout(r, 500));
    }
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'qa_pricing_modal_calc_light.png'), fullPage: false });

    // Close modal
    const modalClose = await page.$$('div.modal-glass button');
    for (const b of modalClose) {
      const text = await page.evaluate(el => el.textContent, b);
      if (text.includes('Cancel')) {
        await b.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 400));

    // 6. Switch to Dark Mode Pricing Page Overview
    console.log('6. Capturing Dark Mode Pricing Page...');
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      const m = document.querySelector('main');
      if (m) m.scrollTo(0, 0);
    });
    // switch back to All Views
    const allViewsBtn = await page.$$('button');
    for (const b of allViewsBtn) {
      const text = await page.evaluate(el => el.textContent, b);
      if (text.includes('All Views')) {
        await b.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'qa_pricing_redesigned_dark.png'), fullPage: false });

    console.log('All QA screenshots captured successfully!');
  } catch (err) {
    console.error('QA capture error:', err);
  } finally {
    await browser.close();
  }
}

run();
