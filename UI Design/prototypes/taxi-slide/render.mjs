// Снимает preview.png (все экраны) и макет игрового экрана для §7.1 спеки.
// Нужен playwright: node render.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const specScreen = path.join(dir, '../../../specs/screens/02-two-moves-later.png');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1700, height: 1000 } });
const car = readFileSync(path.join(dir, 'assets/taxi-car.svg'), 'utf8');
await page.addInitScript((svg) => { window.TAXI_CAR = svg; }, car);
await page.goto('file://' + path.join(dir, 'index.html'));
await page.evaluate(() => document.fonts.ready);
await page.locator('#sheet').screenshot({ path: path.join(dir, 'preview.png') });
await page.locator('#game-screen').screenshot({ path: specScreen });
await browser.close();
