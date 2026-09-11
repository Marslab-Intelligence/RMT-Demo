import puppeteer from 'puppeteer';
import path from 'path';

const outDir = '/home/sameer/.gemini/antigravity-ide/brain/98e8b1ac-d794-48a0-bc01-f4ffc1e87929';

async function run() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1440, height: 900 },
  });

  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3001/login', { waitUntil: 'domcontentloaded' });

    // Click CEO demo button
    await page.waitForSelector('button', { timeout: 10000 });
    const buttons = await page.$$('button');
    for (const b of buttons) {
      const text = await page.evaluate(el => el.innerText, b);
      if (text.includes('Executive Leadership')) {
        await Promise.all([
          b.click(),
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {}),
        ]);
        break;
      }
    }

    await new Promise(r => setTimeout(r, 2000));

    // Click on suggestion chip "How is the company doing?"
    console.log('Clicking suggestion chip...');
    const chips = await page.$$('button');
    for (const c of chips) {
      const text = await page.evaluate(el => el.innerText, c);
      if (text.includes('How is the company doing?')) {
        await c.click();
        console.log('Clicked chip:', text);
        break;
      }
    }

    await new Promise(r => setTimeout(r, 2500));
    const queryModalPath = path.join(outDir, 'ceo_query_response.png');
    await page.screenshot({ path: queryModalPath, fullPage: false });
    console.log('Captured Executive Query Response modal screenshot:', queryModalPath);
  } finally {
    await browser.close();
  }
}

run();
