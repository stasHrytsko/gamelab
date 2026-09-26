import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Direction, Level } from '../src/engine/types.ts';
import type { SolutionMove } from '../tools/solver.ts';

const pack = JSON.parse(readFileSync(new URL('../src/levels/levels.json', import.meta.url), 'utf8')) as { levels: Level[] };
const solutions = JSON.parse(readFileSync(new URL('../tools/solutions.json', import.meta.url), 'utf8')) as {
  level: number;
  moves: SolutionMove[];
}[];

async function idle(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="board"]:not([data-busy])')).toBeVisible();
}

/** Ведёт плитку мышью с шагами — те же pointer-события, что и от пальца. */
async function swipe(page: Page, blockId: string, direction: Direction): Promise<void> {
  const box = await page.locator(`[data-block="${blockId}"]`).boundingBox();
  if (box === null) throw new Error(`${blockId} not on screen`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const step = box.width * 0.8;
  const offsets: Record<Direction, readonly [number, number]> = { up: [0, -step], down: [0, step], left: [-step, 0], right: [step, 0] };
  const [dx, dy] = offsets[direction];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 6 });
  await page.mouse.up();
}

/** Проигрывает маршрут солвера свайпами. */
async function playRoute(page: Page, levelId: number): Promise<void> {
  const level = pack.levels[levelId - 1];
  const route = solutions.find((entry) => entry.level === levelId)?.moves;
  if (level === undefined || route === undefined) throw new Error(`no route for ${String(levelId)}`);
  const where = new Map(level.blocks.map((block) => [block.id, { row: block.row, col: block.col }]));
  for (const move of route) {
    const from = where.get(move.blockId);
    if (from === undefined) throw new Error(`${move.blockId} unknown`);
    const direction: Direction =
      move.row < from.row ? 'up' : move.row > from.row ? 'down' : move.col < from.col ? 'left' : 'right';
    await idle(page);
    await swipe(page, move.blockId, direction);
    where.set(move.blockId, { row: move.row, col: move.col });
  }
}

test('с главного до победы на уровне 1 и открытия уровня 2', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('play').click({ force: true });
  await expect(page.getByTestId('level-2')).toHaveClass(/locked/);
  await page.getByTestId('level-1').click();

  await expect(page.getByTestId('popup-help')).toBeVisible();
  await page.locator('[data-action="ok"]').click();
  await expect(page.getByTestId('left')).toHaveText('3');

  await playRoute(page, 1);
  await expect(page.getByTestId('popup-win')).toBeVisible();
  await expect(page.getByTestId('left')).toHaveText('0');

  await page.locator('[data-action="next"]').click();
  await expect(page.getByTestId('game')).toHaveAttribute('data-level', '2');
  // «Как играть» сам открывается только один раз.
  await expect(page.getByTestId('popup-help')).toHaveCount(0);

  await page.getByTestId('to-levels').click();
  await expect(page.getByTestId('level-1').locator('.check')).toBeVisible();
  await expect(page.getByTestId('level-2')).toHaveClass(/current/);
});

test('все пять уровней проходятся маршрутом солвера', async ({ page }) => {
  await page.goto('/?unlock=all#/level/2');
  for (const id of [2, 3, 4, 5]) {
    await page.goto(`/?unlock=all#/level/${String(id)}`);
    await expect(page.getByTestId('game')).toHaveAttribute('data-level', String(id));
    await playRoute(page, id);
    await expect(page.getByTestId(id === 5 ? 'popup-final' : 'popup-win')).toBeVisible();
  }
  await expect(page.getByTestId('popup-final')).toContainText('Все уровни пройдены');
});

test('проигрыш, когда счётчик цели кончился, и переигровка', async ({ page }) => {
  await page.goto('/?unlock=all#/level/2');
  const level = pack.levels[1];
  if (level === undefined) throw new Error('no level 2');
  const first = level.goals.find((p) => p.unlockAfterServed === 0);
  // Плитку чужого цвета рядом с пустой клеткой гоняем туда-обратно.
  const empty = new Set(Array.from({ length: 25 }, (_, i) => i));
  for (const block of level.blocks) empty.delete(block.row * 5 + block.col);
  const dirs: [Direction, Direction, number, number][] = [['right', 'left', 0, 1], ['left', 'right', 0, -1], ['down', 'up', 1, 0], ['up', 'down', -1, 0]];
  let pick: { id: string; there: Direction; back: Direction } | null = null;
  for (const block of level.blocks) {
    if (block.color === first?.color) continue;
    for (const [there, back, dr, dc] of dirs) {
      const r = block.row + dr;
      const c = block.col + dc;
      if (r >= 0 && r < 5 && c >= 0 && c < 5 && empty.has(r * 5 + c)) pick = { id: block.id, there, back };
    }
    if (pick !== null) break;
  }
  if (pick === null || first === undefined) throw new Error('no shuttle block');
  for (let i = 0; i < first.initialCountdown; i += 1) {
    await idle(page);
    await swipe(page, pick.id, i % 2 === 0 ? pick.there : pick.back);
  }
  await expect(page.getByTestId('popup-lose')).toBeVisible();
  await expect(page.getByTestId('popup-lose')).toContainText('Счётчик цели дошёл до нуля');
  await page.locator('[data-action="replay"]').click();
  await expect(page.getByTestId('popup-lose')).toHaveCount(0);
  await expect(page.getByTestId('left')).toHaveText(String(level.goals.length));
});

test('короткий жест и ход в занятую клетку ничего не тратят', async ({ page }) => {
  await page.goto('/?unlock=all#/level/4');
  const goal = page.locator('.goal .num').first();
  const before = await goal.textContent();
  const block = page.locator('[data-block]').first();
  const box = await block.boundingBox();
  if (box === null) throw new Error('no block');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 10, box.y + box.height / 2, { steps: 3 });
  await page.mouse.up();
  await idle(page);
  await expect(goal).toHaveText(before ?? '');
});

test('свайп пальцем (touch) двигает плитку', async ({ page }) => {
  await page.goto('/?unlock=all#/level/1');
  await page.locator('[data-action="ok"]').click();
  const level = pack.levels[0];
  const move = solutions[0]?.moves[0];
  const block = level?.blocks.find((t) => t.id === move?.blockId);
  if (move === undefined || block === undefined) throw new Error('no first move');
  const box = await page.locator(`[data-block="${block.id}"]`).boundingBox();
  if (box === null) throw new Error('no block');
  const dx = (move.col - block.col) * box.width * 0.8;
  const dy = (move.row - block.row) * box.height * 0.8;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', px: number, py: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: px, y: py }] });
  await touch('touchStart', x, y);
  for (let i = 1; i <= 6; i += 1) await touch('touchMove', x + (dx * i) / 6, y + (dy * i) / 6);
  await touch('touchEnd', x + dx, y + dy);
  await idle(page);
  await expect(page.getByTestId('game')).toHaveAttribute('data-moves', '1');
});
