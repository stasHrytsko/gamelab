/**
 * Снимает экраны прототипа для §7.1 спеки в UI Design/prototypes/roll-pack/:
 *   npm run build && npx tsx tools/make-screens.ts
 * Броски подменяются генератором с зерном — только для съёмки.
 */
import { chromium, devices, type Page } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Solver } from './solver.ts';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '../../../UI Design/prototypes/roll-pack');
mkdirSync(out, { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', '4176', '--strictPort'], { cwd: join(here, '..'), stdio: 'ignore' });
await new Promise((resolve) => setTimeout(resolve, 2500));
const base = 'http://localhost:4176';

const browser = await chromium.launch();
async function phone(seed: number): Promise<Page> {
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  await page.addInitScript((initial) => {
    let s = initial;
    Math.random = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
    localStorage.setItem('roll-pack:progress:v1', JSON.stringify({ passed: [1, 2], howToPlaySeen: true }));
  }, seed);
  return page;
}
const nums = async (page: Page, attr: string): Promise<number[]> =>
  ((await page.getByTestId('game').getAttribute(attr)) ?? '').split(',').map(Number);
const settle = (page: Page): Promise<void> => page.waitForTimeout(700);

async function move(page: Page, solver: Solver): Promise<void> {
  const { move: best } = solver.best(await nums(page, 'data-heights'), await nums(page, 'data-dice'));
  if (best === null) return;
  const dice = await nums(page, 'data-dice');
  await page.getByTestId(`die-${String(dice.indexOf(best.length))}`).click();
  const hand = page.getByTestId('hand');
  const from = Number(await hand.getAttribute('data-x'));
  const box = await hand.boundingBox();
  const a = await page.locator('.slot[data-row="0"][data-col="0"]').boundingBox();
  const b = await page.locator('.slot[data-row="0"][data-col="1"]').boundingBox();
  if (box === null || a === null || b === null) return;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + (best.x - from) * (b.x - a.x), cy, { steps: 6 });
  await page.mouse.up();
  await settle(page);
}

// 1. Главный и уровни.
let page = await phone(1);
await page.goto(`${base}/`);
await settle(page);
await page.screenshot({ path: join(out, '1-home.png') });
await page.goto(`${base}/#/levels`);
await settle(page);
await page.screenshot({ path: join(out, '2-levels.png') });

// 2. Игровой экран уровня 3 посреди партии, кубик выбран.
page = await phone(4);
await page.goto(`${base}/#/level/3`);
await settle(page);
const solver = new Solver(4);
for (let i = 0; i < 4; i += 1) await move(page, solver);
const dice = await nums(page, 'data-dice');
const heights = await nums(page, 'data-heights');
const pick = solver.best(heights, dice).move;
if (pick !== null) await page.getByTestId(`die-${String(dice.indexOf(pick.length))}`).click();
await page.waitForTimeout(300);
await page.screenshot({ path: join(out, 'game-screen.png') });

// 3. Как играть.
await page.locator('.die.selected').click();
await page.getByTestId('help').click();
await settle(page);
await page.screenshot({ path: join(out, '3-help.png') });

// 4. Поражение: жадно кладём самое длинное число.
page = await phone(3);
await page.goto(`${base}/?unlock=all#/level/5`);
await settle(page);
for (let turn = 0; turn < 40 && (await page.getByTestId('game').getAttribute('data-status')) === 'playing'; turn += 1) {
  const values = await nums(page, 'data-dice');
  const order = values.map((v, i) => ({ v, i })).sort((x, y) => y.v - x.v);
  for (const { i } of order) {
    const die = page.getByTestId(`die-${String(i)}`);
    if (await die.evaluate((el) => el.classList.contains('dead'))) continue;
    await die.click();
    const hand = page.getByTestId('hand');
    const box = await hand.boundingBox();
    if (box === null) break;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await settle(page);
    break;
  }
}
await page.waitForTimeout(1400);
await page.screenshot({ path: join(out, '4-lose.png') });

// 5. Победа на уровне 1.
page = await phone(11);
await page.goto(`${base}/?unlock=all#/level/1`);
await settle(page);
const small = new Solver(2);
for (let attempt = 0; attempt < 10; attempt += 1) {
  while ((await page.getByTestId('game').getAttribute('data-status')) === 'playing') await move(page, small);
  if ((await page.getByTestId('game').getAttribute('data-status')) === 'won') break;
  await page.waitForTimeout(1400);
  await page.locator('[data-action="replay"]').click();
  await settle(page);
}
await page.waitForTimeout(1600);
await page.screenshot({ path: join(out, '5-win.png') });

await browser.close();
server.kill();
