// Снимает preview.png (все экраны) и макет игрового экрана для §7.1 спеки.
// Нужен playwright: node render.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const specScreen = path.join(dir, 'game-screen.png');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1700, height: 1000 } });
await page.goto('file://' + path.join(dir, 'index.html'));
await page.evaluate(() => document.fonts.ready);
await page.locator('#sheet').screenshot({ path: path.join(dir, 'preview.png') });
await page.locator('#game-screen').screenshot({ path: specScreen });
await browser.close();
