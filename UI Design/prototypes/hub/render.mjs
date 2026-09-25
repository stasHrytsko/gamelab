// node render.mjs — снимает preview.png
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 700, height: 1000 } });
await page.goto('file://' + path.join(dir, 'index.html'));
await page.evaluate(() => document.fonts.ready);
await page.locator('#sheet').screenshot({ path: path.join(dir, 'preview.png') });
await browser.close();
