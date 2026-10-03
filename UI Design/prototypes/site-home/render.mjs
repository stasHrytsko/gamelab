// Снимает preview-desktop.png (1440) и preview-mobile.png (390) из index.html.
import { chromium } from '/home/user/stazzi/node_modules/@playwright/test/index.mjs';
import { fileURLToPath } from 'node:url';
const url = new URL('./index.html', import.meta.url).href;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [name, w, h] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: name === 'mobile' ? 2 : 1 });
  await p.goto(url); await p.waitForTimeout(600);
  await p.screenshot({ path: fileURLToPath(new URL(`./preview-${name}.png`, import.meta.url)), fullPage: true });
  await p.close();
}
await b.close();
