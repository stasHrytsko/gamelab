/**
 * Иконки и картинка превью ссылки из tools/brand.html:
 *   npx tsx tools/make-images.ts
 * Результат коммитится в public/ — на Vercel браузера нет.
 */
import { chromium } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pub = join(here, '../public');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1300 } });
await page.goto(`file://${join(here, 'brand.html')}`);
await page.evaluate(() => document.fonts.ready);

for (const [size, name] of [[512, 'icon-512.png'], [192, 'icon-192.png'], [180, 'apple-touch-icon.png']] as const) {
  const scaled = await browser.newPage({ viewport: { width: 1400, height: 1300 }, deviceScaleFactor: size / 512 });
  await scaled.goto(`file://${join(here, 'brand.html')}`);
  await scaled.evaluate(() => document.fonts.ready);
  await scaled.locator('#icon').screenshot({ path: join(pub, name) });
  await scaled.close();
}
await page.locator('#og').screenshot({ path: join(pub, 'og.png') });
await browser.close();
