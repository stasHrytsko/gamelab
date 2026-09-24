/**
 * Иконки и картинка превью ссылки из tools/brand.html:
 *   npx tsx tools/make-images.ts
 * Результат коммитится в public/ — на Vercel браузера нет.
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pub = join(here, '../public');
const car = readFileSync(join(here, '../../../UI Design/prototypes/taxi-slide/assets/taxi-car.svg'), 'utf8');
// Машинка — одна, из UI Design: вставляется в каждый .cab перед снимком.
const withCars = (html: string): void => {
  for (const cab of document.querySelectorAll('.cab')) cab.insertAdjacentHTML('afterbegin', html);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1300 } });
await page.goto(`file://${join(here, 'brand.html')}`);
await page.evaluate(() => document.fonts.ready);
await page.evaluate(withCars, car);

for (const [size, name] of [[512, 'icon-512.png'], [192, 'icon-192.png'], [180, 'apple-touch-icon.png']] as const) {
  const scaled = await browser.newPage({ viewport: { width: 1400, height: 1300 }, deviceScaleFactor: size / 512 });
  await scaled.goto(`file://${join(here, 'brand.html')}`);
  await scaled.evaluate(() => document.fonts.ready);
  await scaled.evaluate(withCars, car);
  await scaled.locator('#icon').screenshot({ path: join(pub, name) });
  await scaled.close();
}
await page.locator('#og').screenshot({ path: join(pub, 'og.png') });
await browser.close();
