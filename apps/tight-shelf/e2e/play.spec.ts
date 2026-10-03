import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import * as solver from '../../../tools/tight-shelf-solver.mjs';
import { createState, fits, legalNow, place, tapCell } from '../src/engine/shelfEngine.ts';
import type { GameState, Level } from '../src/engine/types.ts';

// levels.json читается напрямую: раннер Playwright грузит TS как ESM, а JSON-модуль без атрибута там не импортируется.
const LEVELS = JSON.parse(readFileSync(new URL('../src/levels/levels.json', import.meta.url), 'utf8')) as Level[];

async function idle(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="game"]:not([data-busy]), [data-testid="game"][data-status="won"], [data-testid="game"][data-status="failed"]')).toHaveCount(1);
}

async function tap(page: Page, cell: number): Promise<void> {
  await page.getByTestId(`cell-${String(cell)}`).click();
  await idle(page);
}

function level(id: number): Level {
  const found = LEVELS[id - 1];
  if (found === undefined) throw new Error(`no level ${String(id)}`);
  return found;
}

/** Проходит уровень решением солвера. */
async function solveLevel(page: Page, id: number): Promise<void> {
  const cells = solver.solution(level(id));
  if (cells === null) throw new Error(`level ${String(id)} unsolvable`);
  for (const cell of cells) await tap(page, cell);
}

/** Ходы жадного бота (§6): больше всего исчезнувших фигур, при равенстве первая клетка. */
function greedyMoves(id: number): { cells: number[]; state: GameState } {
  let state = createState(level(id));
  const cells: number[] = [];
  while (state.status === 'playing') {
    const piece = state.queue[state.turn];
    if (piece === undefined) break;
    let best = -1;
    let choice = -1;
    for (const c of legalNow(state)) {
      const n = place(state.board, c, piece).cleared.length;
      if (n > best) { best = n; choice = c; }
    }
    cells.push(choice);
    state = (tapCell(state, choice) as { state: GameState }).state;
  }
  return { cells, state };
}

test('с главного до победы на уровне 1 и открытия уровня 2', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('home')).toContainText('Tight Shelf');
  await page.getByTestId('play').click({ force: true });
  await expect(page.getByTestId('level-2')).toHaveClass(/locked/);
  await page.getByTestId('level-1').click();
  await expect(page.getByTestId('popup-help')).toBeVisible();
  await page.locator('[data-action="ok"]').click();

  await solveLevel(page, 1);
  await expect(page.getByTestId('popup-win')).toBeVisible();
  await page.locator('[data-action="next"]').click();
  await expect(page.getByTestId('game')).toHaveAttribute('data-level', '2');
  await expect(page.getByTestId('popup-help')).toHaveCount(0);

  await page.getByTestId('to-levels').click();
  await expect(page.getByTestId('level-1').locator('.check')).toBeVisible();
  await expect(page.getByTestId('level-2')).toHaveClass(/current/);
});

test('все пять уровней проходятся, после пятого — финальный попап', async ({ page }) => {
  test.setTimeout(240_000);
  for (const id of [1, 2, 3, 4, 5]) {
    await page.goto(`/?unlock=all#/level/${String(id)}`);
    if (id === 1) await page.locator('[data-action="ok"]').click();
    await expect(page.getByTestId('game')).toHaveAttribute('data-level', String(id));
    await solveLevel(page, id);
    await expect(page.getByTestId(id === 5 ? 'popup-final' : 'popup-win')).toBeVisible();
  }
});

test('недопустимый тап не тратит ход; подсказок «куда можно» нет', async ({ page }) => {
  await page.goto('/?unlock=all#/level/3');
  const game = page.getByTestId('game');
  const lv = level(3);
  const rules = lv.rules.join('').split('');
  const first = lv.queue[0] ?? 'Bo';
  const bad = rules.findIndex((r) => r !== '.' && r !== first[0] && r !== first[1]);
  const good = rules.findIndex((r) => r === '.' || r === first[0] || r === first[1]);
  // Клетки не приглушаются и не подсвечиваются под текущую фигуру.
  await expect(page.locator('.cell.off, .cell.dead')).toHaveCount(0);
  await page.getByTestId(`cell-${String(bad)}`).click();
  await expect(game).toHaveAttribute('data-turn', '0');

  await tap(page, good);
  await expect(game).toHaveAttribute('data-turn', '1');
  // Занятая клетка.
  await page.getByTestId(`cell-${String(good)}`).click();
  await expect(game).toHaveAttribute('data-turn', '1');
  await expect(page.getByTestId(`cell-${String(good)}`).locator('.piece')).toHaveCount(1);
});

test('линия исчезает: фигуры уходят с поля', async ({ page }) => {
  await page.goto('/?unlock=all#/level/1');
  await page.locator('[data-action="ok"]').click();
  const cells = solver.solution(level(1)) ?? [];
  let state = createState(level(1));
  for (const cell of cells) {
    const out = tapCell(state, cell);
    if (out === null) throw new Error('bad solution');
    await tap(page, cell);
    if (out.move.lines > 0) {
      for (const c of out.move.cleared) await expect(page.getByTestId(`cell-${String(c)}`).locator('.piece')).toHaveCount(0);
      return;
    }
    state = out.state;
  }
  throw new Error('на уровне 1 нет ни одной линии');
});

test('жадная игра на уровне 3 упирается в no_moves; «Переиграть» — с начала', async ({ page }) => {
  const { cells, state } = greedyMoves(3);
  expect(state.status).toBe('failed');
  await page.goto('/?unlock=all#/level/3');
  for (const cell of cells) await tap(page, cell);
  const game = page.getByTestId('game');
  await expect(game).toHaveAttribute('data-status', 'failed');
  await expect(page.getByTestId('popup-lose')).toContainText('has nowhere to go');
  await page.locator('[data-action="replay"]').click();
  await expect(page.getByTestId('popup-lose')).toHaveCount(0);
  await expect(game).toHaveAttribute('data-turn', '0');
  await expect(page.locator('.cell .piece')).toHaveCount(0);
});

test('очередь: текущая и три следующих, по порядку', async ({ page }) => {
  await page.goto('/?unlock=all#/level/2');
  const q = level(2).queue;
  await expect(page.getByTestId('now').locator('.piece')).toHaveAttribute('data-piece', q[0] ?? '');
  const next = page.getByTestId('next').locator('.piece');
  await expect(next).toHaveCount(3);
  for (let k = 0; k < 3; k += 1) await expect(next.nth(k)).toHaveAttribute('data-piece', q[k + 1] ?? '');
  const rules = level(2).rules.join('').split('');
  const first = q[0] ?? 'Bo';
  await tap(page, rules.findIndex((r) => fits(r as '.', first)));
  await expect(page.getByTestId('now').locator('.piece')).toHaveAttribute('data-piece', q[1] ?? '');
});

test('экран помещается без прокрутки (§7.1)', async ({ browser }) => {
  for (const [width, height] of [[360, 560], [375, 560], [390, 664], [430, 932]] as const) {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: true, hasTouch: true });
    for (const id of [1, 3, 5]) {
      await page.goto(`/?unlock=all#/level/${String(id)}`);
      if (id === 1) {
        await expect(page.getByTestId('popup-help')).toBeVisible();
        await page.locator('[data-action="ok"]').click();
        await expect(page.getByTestId('popup-help')).toHaveCount(0);
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      expect(overflow, `${String(width)}×${String(height)}, уровень ${String(id)}`).toBeLessThanOrEqual(0);
      const hint = await page.locator('.hint').boundingBox();
      expect((hint?.y ?? 0) + (hint?.height ?? 0), `${String(width)}×${String(height)}`).toBeLessThanOrEqual(height);
      const board = await page.getByTestId('board').boundingBox();
      expect(board?.x ?? -1).toBeGreaterThanOrEqual(0);
      expect((board?.x ?? 0) + (board?.width ?? 0)).toBeLessThanOrEqual(width);
    }
    await page.close();
  }
});
