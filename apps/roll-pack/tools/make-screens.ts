/**
 * Снимает экраны прототипа для §7.1 спеки в UI Design/prototypes/roll-pack/:
 *   npm run build && npx tsx tools/make-screens.ts
 */
import { chromium, type Page } from '@playwright/test';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize, parseMap, solve } from '../src/engine/packEngine.ts';
import type { Point } from '../src/engine/types.ts';
import { LEVELS } from '../src/levels/levels.ts';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '../../../UI Design/prototypes/roll-pack');
const server = spawn('npx', ['vite', 'preview', '--port', '4177', '--strictPort'], { cwd: join(here, '..'), stdio: 'ignore' });
await new Promise((resolve) => setTimeout(resolve, 2500));
const base = 'http://localhost:4177';
const browser = await chromium.launch();

async function phone(width = 390, height = 664, progress = { passed: [1, 2], howToPlaySeen: true }): Promise<Page> {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.addInitScript((p) => localStorage.setItem('build-pack:progress:v1', JSON.stringify(p)), progress);
  return page;
}
const settle = (page: Page): Promise<void> => page.waitForTimeout(600);

async function put(page: Page, cells: readonly Point[], index: number, drop = true): Promise<void> {
  await page.getByTestId(`num-${String(index)}`).click();
  const shape = normalize(cells);
  for (const [r, c] of shape) await page.getByTestId(`b-${String(r)}-${String(c)}`).click();
  if (!drop) return;
  const grab = shape[0] as Point;
  const r0 = Math.min(...cells.map((p) => p[0]));
  const c0 = Math.min(...cells.map((p) => p[1]));
  const from = await page.getByTestId(`b-${String(grab[0])}-${String(grab[1])}`).boundingBox();
  const to = await page.locator(`.cell[data-r="${String(r0 + grab[0])}"][data-c="${String(c0 + grab[1])}"]`).boundingBox();
  const a = await page.locator('.cell[data-r="0"][data-c="0"]').boundingBox();
  const b = await page.locator('.cell[data-r="0"][data-c="1"]').boundingBox();
  if (from === null || to === null || a === null || b === null) return;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 + (b.x - a.x) * 1.2, { steps: 8 });
  await page.mouse.up();
  await settle(page);
}

function plan(id: number): { pieces: Point[][]; index: number[] } {
  const level = LEVELS[id - 1];
  if (level === undefined) throw new Error('level');
  const pieces = solve(parseMap(level.map), level.numbers) ?? [];
  const used = level.numbers.map(() => false);
  const index = pieces.map((p) => {
    const i = level.numbers.findIndex((n, j) => n === p.length && !used[j]);
    used[i] = true;
    return i;
  });
  return { pieces, index };
}

let page = await phone();
await page.goto(`${base}/`);
await settle(page);
await page.screenshot({ path: join(out, '1-home.png') });
await page.goto(`${base}/#/levels`);
await settle(page);
await page.screenshot({ path: join(out, '2-levels.png') });

// Игровой экран: уровень 2, две фигуры уложены, третья собирается.
page = await phone();
await page.goto(`${base}/#/level/2`);
await settle(page);
{
  const { pieces, index } = plan(2);
  for (let i = 0; i < 2; i += 1) await put(page, pieces[i] ?? [], index[i] ?? 0);
  const next = pieces[2] ?? [];
  await page.getByTestId(`num-${String(index[2] ?? 0)}`).click();
  for (const [r, c] of normalize(next).slice(0, next.length - 2)) await page.getByTestId(`b-${String(r)}-${String(c)}`).click();
}
await settle(page);
await page.screenshot({ path: join(out, 'game-screen.png') });
await page.getByTestId('help').click({ force: true });
await page.getByTestId('clear').click().catch(() => undefined);
await settle(page);

page = await phone();
await page.goto(`${base}/#/level/2`);
await settle(page);
await page.getByTestId('help').click();
await settle(page);
await page.screenshot({ path: join(out, '3-help.png') });

// Маленький экран, уровень 5 — самое узкое место по высоте.
page = await phone(360, 560, { passed: [1, 2, 3, 4], howToPlaySeen: true });
await page.goto(`${base}/#/level/5`);
await settle(page);
await page.getByTestId('num-0').click();
await page.screenshot({ path: join(out, 'game-small.png') });

// Проигрыш.
page = await phone();
await page.goto(`${base}/#/level/2`);
await settle(page);
await put(page, [[0, 1], [1, 0], [1, 1], [1, 2]], 5);
await page.waitForTimeout(1500);
await page.screenshot({ path: join(out, '4-lose.png') });

// Победа.
page = await phone();
await page.goto(`${base}/#/level/1`);
await settle(page);
{
  const { pieces, index } = plan(1);
  for (let i = 0; i < pieces.length; i += 1) await put(page, pieces[i] ?? [], index[i] ?? 0);
}
await page.waitForTimeout(1600);
await page.screenshot({ path: join(out, '5-win.png') });

await browser.close();
server.kill();
