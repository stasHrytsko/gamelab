/**
 * Снимает экраны прототипа для §7.1 спеки в UI Design/prototypes/tight-shelf/:
 *   npm run build && npx tsx tools/make-screens.ts
 */
import { chromium, type Page } from '@playwright/test';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as solver from '../../../tools/tight-shelf-solver.mjs';
import { createState, legalNow, place, tapCell } from '../src/engine/shelfEngine.ts';
import type { GameState } from '../src/engine/types.ts';
import { LEVELS } from '../src/levels/levels.ts';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '../../../UI Design/prototypes/tight-shelf');
const server = spawn('npx', ['vite', 'preview', '--port', '4184', '--strictPort'], { cwd: join(here, '..'), stdio: 'ignore' });
await new Promise((resolve) => setTimeout(resolve, 2500));
const base = 'http://localhost:4184';
const browser = await chromium.launch();

async function phone(width = 390, height = 664, progress = { passed: [1, 2], howToPlaySeen: true }): Promise<Page> {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.addInitScript((p) => localStorage.setItem('tight-shelf:progress:v1', JSON.stringify(p)), progress);
  return page;
}
const settle = (page: Page, ms = 700): Promise<void> => page.waitForTimeout(ms);
const level = (id: number): (typeof LEVELS)[number] => LEVELS[id - 1] as (typeof LEVELS)[number];

/** Тап и ожидание конца хода; `ms` — пауза для кадра посреди анимации. */
async function tap(page: Page, cell: number, ms?: number): Promise<void> {
  await page.getByTestId(`cell-${String(cell)}`).click();
  if (ms !== undefined) {
    await settle(page, ms);
    return;
  }
  await page.locator('[data-testid="game"]:not([data-busy]), [data-testid="game"][data-status="won"], [data-testid="game"][data-status="failed"]').first().waitFor();
}

let page = await phone();
await page.goto(`${base}/`);
await settle(page, 1800);
await page.screenshot({ path: join(out, '1-home.png') });
await page.goto(`${base}/#/levels`);
await settle(page);
await page.screenshot({ path: join(out, '2-levels.png') });

// Игровой экран: уровень 3, семь фигур поставлено по решению солвера.
page = await phone(390, 664, { passed: [1, 2], howToPlaySeen: true });
await page.goto(`${base}/#/level/3`);
await settle(page);
for (const cell of (solver.solution(level(3)) ?? []).slice(0, 7)) await tap(page, cell);
await page.screenshot({ path: join(out, 'app-game.png') });

// Момент очистки: снимок посреди анимации линии на уровне 1.
page = await phone();
await page.goto(`${base}/#/level/1`);
await settle(page);
{
  let state: GameState = createState(level(1));
  for (const cell of solver.solution(level(1)) ?? []) {
    const outcome = tapCell(state, cell);
    if (outcome === null) break;
    if (outcome.move.lines > 0) {
      await tap(page, cell, 290);
      await page.screenshot({ path: join(out, 'app-clear.png') });
      break;
    }
    await tap(page, cell);
    state = outcome.state;
  }
}

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
await page.screenshot({ path: join(out, 'app-small.png') });

// Проигрыш: жадная игра на уровне 3.
page = await phone();
await page.goto(`${base}/#/level/3`);
await settle(page);
{
  let state: GameState = createState(level(3));
  while (state.status === 'playing') {
    const piece = state.queue[state.turn];
    if (piece === undefined) break;
    let best = -1;
    let choice = -1;
    for (const c of legalNow(state)) {
      const n = place(state.board, c, piece).cleared.length;
      if (n > best) { best = n; choice = c; }
    }
    await tap(page, choice);
    state = (tapCell(state, choice) as { state: GameState }).state;
  }
}
await settle(page, 1500);
await page.screenshot({ path: join(out, '4-lose.png') });

// Победа.
page = await phone();
await page.goto(`${base}/#/level/1`);
await settle(page);
for (const cell of solver.solution(level(1)) ?? []) await tap(page, cell);
await settle(page, 1600);
await page.screenshot({ path: join(out, '5-win.png') });

await browser.close();
server.kill();
