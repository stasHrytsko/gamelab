import { expect, test, type Page } from '@playwright/test';
import { parse, solve } from '../../../tools/sprout-solver.mjs';
import { LEVELS } from '../src/levels/levels.ts';
import { SIZE } from '../src/engine/types.ts';

async function idle(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="game"]:not([data-busy]), [data-testid="game"][data-status="won"], [data-testid="game"][data-status="failed"]')).toHaveCount(1);
}

const cellId = (i: number): string => `cell-${String(Math.floor(i / SIZE))}-${String(i % SIZE)}`;

/** Проходит уровень победным путём солвера, тапая клетки по очереди. */
async function solveLevel(page: Page, id: number): Promise<void> {
  const level = LEVELS[id - 1];
  if (level === undefined) throw new Error(`no level ${String(id)}`);
  const path = [...solve(parse(level), { orders: true }).orders.values()][0];
  if (path === undefined) throw new Error(`level ${String(id)} unsolvable`);
  for (const i of path.slice(1)) {
    await page.getByTestId(cellId(i)).click();
    await idle(page);
  }
}

test('с главного до победы на уровне 1 и открытия уровня 2', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('home')).toBeVisible();
  await page.getByTestId('play').click({ force: true });
  await expect(page.getByTestId('level-2')).toHaveClass(/locked/);
  await page.getByTestId('level-1').click();
  await expect(page.getByTestId('popup-help')).toBeVisible();
  await page.locator('[data-action="ok"]').click();
  await expect(page.getByTestId('hint')).toBeVisible();

  await solveLevel(page, 1);
  await expect(page.getByTestId('popup-win')).toBeVisible();
  await page.locator('[data-action="next"]').click();
  await expect(page.getByTestId('game')).toHaveAttribute('data-level', '2');
  await expect(page.getByTestId('popup-help')).toHaveCount(0);
  await expect(page.getByTestId('hint')).toHaveCount(0);

  await page.getByTestId('to-levels').click();
  await expect(page.getByTestId('level-1').locator('.check')).toBeVisible();
  await expect(page.getByTestId('level-2')).toHaveClass(/current/);
});

test('все пять уровней проходятся, после пятого — финальный попап', async ({ page }) => {
  test.setTimeout(180_000);
  for (const id of [1, 2, 3, 4, 5]) {
    await page.goto(`/?unlock=all#/level/${String(id)}`);
    if (id === 1) await page.locator('[data-action="ok"]').click();
    await expect(page.getByTestId('game')).toHaveAttribute('data-level', String(id));
    await solveLevel(page, id);
    await expect(page.getByTestId(id === 5 ? 'popup-final' : 'popup-win')).toBeVisible();
  }
});

test('вода: −1 и +X, счётчик показывает запас после прилёта капли', async ({ page }) => {
  // Уровень 3: А f1 (5,5), запас 4. f2 (4,5) → 3, f3 (3,5) → 2, e3 (3,4) вода +4 → 1 + 4 = 5.
  await page.goto('/?unlock=all#/level/3');
  for (const id of ['cell-4-5', 'cell-3-5']) {
    await page.getByTestId(id).click();
    await idle(page);
  }
  await expect(page.getByTestId('moves').locator('b')).toHaveText('2');
  await page.getByTestId('cell-3-4').click();
  await idle(page);
  await expect(page.getByTestId('game')).toHaveAttribute('data-moves', '5');
  await expect(page.getByTestId('moves').locator('b')).toHaveText('5');
  await expect(page.getByTestId('cell-3-4').locator('.sip-mark')).toHaveCount(1);
});

test('недопустимые тапы не тратят ход: камень, корень, клетка вдали', async ({ page }) => {
  // Уровень 3: А f1 (5,5). Над e2-водой (4,4) камня нет; камень — d2 (4,3).
  await page.goto('/?unlock=all#/level/3');
  await page.getByTestId('cell-5-4').click(); // e1
  await idle(page);
  await expect(page.getByTestId('game')).toHaveAttribute('data-moves', '3');
  for (const id of ['cell-5-5', 'cell-0-0', 'cell-4-3']) {
    // А (корень) — соседняя клетка корня; a6 — вдали; d2 — не сосед e1, тап вдали.
    await page.getByTestId(id).click();
    await page.waitForTimeout(350);
    await expect(page.getByTestId('game')).toHaveAttribute('data-moves', '3');
    await expect(page.getByTestId('game')).toHaveAttribute('data-steps', '1');
  }
  await page.getByTestId('cell-5-3').click(); // d1
  await idle(page);
  await page.getByTestId('cell-4-3').click(); // d2 — камень, соседний с d1
  await page.waitForTimeout(350);
  await expect(page.getByTestId('game')).toHaveAttribute('data-steps', '2');
});

test('ловушка: ближайшая вода проигрывает уровень 3, «Переиграть» возвращает старт', async ({ page }) => {
  await page.goto('/?unlock=all#/level/3');
  // Приманка e2 (4,4) через e1: запас 4 → 3 → 2 + 3 = 5. Дальше e3 (3,4) +4 = 8,
  // f3 (3,5), f2 (4,5): тупик — вокруг корень и камни.
  for (const id of ['cell-5-4', 'cell-4-4', 'cell-3-4', 'cell-3-5', 'cell-4-5']) {
    await page.getByTestId(id).click();
    await idle(page);
  }
  await expect(page.getByTestId('game')).toHaveAttribute('data-status', 'failed');
  await expect(page.getByTestId('popup-lose')).toBeVisible();
  await expect(page.getByTestId('popup-lose')).toContainText('nowhere to grow');
  await page.locator('[data-action="replay"]').click();
  await expect(page.getByTestId('popup-lose')).toHaveCount(0);
  await expect(page.getByTestId('game')).toHaveAttribute('data-steps', '0');
  await expect(page.getByTestId('game')).toHaveAttribute('data-moves', '4');
});

test('ходы кончились — «Ходы закончились»', async ({ page }) => {
  // Уровень 3, запас 4: влево по нижнему ряду без воды.
  await page.goto('/?unlock=all#/level/3');
  for (const id of ['cell-5-4', 'cell-5-3', 'cell-5-2', 'cell-5-1']) {
    await page.getByTestId(id).click();
    await idle(page);
  }
  await expect(page.getByTestId('popup-lose')).toContainText('Out of moves');
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
      const board = await page.getByTestId('board').boundingBox();
      expect(board, 'поле на экране').not.toBeNull();
      expect((board?.y ?? 0) + (board?.height ?? 0), `поле влезает по высоте ${String(width)}×${String(height)}`).toBeLessThanOrEqual(height);
    }
    await page.close();
  }
});
