import { expect, test, type Page } from '@playwright/test';
import { LEVELS } from '../src/levels/levels.ts';
import type { Action } from '../src/engine/types.ts';

async function idle(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="game"]:not([data-busy]), [data-testid="game"][data-status="won"], [data-testid="game"][data-status="failed"]')).toHaveCount(1);
}

const VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] } as const;

/** Свайп мышью по квадрату на (x, y) в направлении dir — как палец: 60 px. */
async function swipeSquare(page: Page, x: number, y: number, dir: keyof typeof VEC): Promise<void> {
  const box = await page.getByTestId(`sq-${String(x)}-${String(y)}`).boundingBox();
  if (box === null) throw new Error(`нет квадрата ${String(x)},${String(y)}`);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const [dx, dy] = VEC[dir];
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx * 30, cy + dy * 30, { steps: 3 });
  await page.mouse.move(cx + dx * 60, cy + dy * 60, { steps: 3 });
  await page.mouse.up();
}

async function play(page: Page, action: Action): Promise<void> {
  if (action.type === 'swipe') await swipeSquare(page, action.x, action.y, action.dir);
  else await page.getByTestId(`flask-${String(action.n)}`).click();
  await idle(page);
}

/** Проходит уровень сохранённым оптимальным решением солвера. */
async function solveLevel(page: Page, id: number): Promise<void> {
  const level = LEVELS[id - 1];
  if (level === undefined) throw new Error(`no level ${String(id)}`);
  for (const action of level.solution) await play(page, action);
}

test('с главного до победы на уровне 1 и открытия уровня 2', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('home')).toBeVisible();
  await page.getByTestId('play').click({ force: true });
  await expect(page.getByTestId('level-2')).toHaveClass(/locked/);
  await page.getByTestId('level-1').click();
  await expect(page.getByTestId('popup-help')).toBeVisible();
  await page.locator('[data-action="ok"]').click();

  await solveLevel(page, 1);
  await expect(page.getByTestId('popup-win')).toBeVisible();
  await expect(page.getByTestId('stars')).toHaveAttribute('data-count', '3');
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

test('недопустимое действие не тратит ход', async ({ page }) => {
  // Уровень 3: колба 1 пуста (тап ничего не делает); клетка (0,1) у левой стены — свайп влево упирается.
  await page.goto('/?unlock=all#/level/3');
  await page.getByTestId('flask-1').click();
  await page.waitForTimeout(300);
  await expect(page.getByTestId('game')).toHaveAttribute('data-moves', '0');
  await swipeSquare(page, 3, 2, 'down'); // (3,2) — нижний ряд, вниз некуда
  await page.waitForTimeout(300);
  await expect(page.getByTestId('game')).toHaveAttribute('data-moves', '0');
});

test('возврат при занятой клетке выхода не тратит ход', async ({ page }) => {
  // Уровень 3: в колбе 4 лежит [2, 1]; клетка выхода 4 — (3,1), на ней стоит квадрат 1.
  await page.goto('/?unlock=all#/level/3');
  await page.getByTestId('flask-4').click();
  await page.waitForTimeout(300);
  await expect(page.getByTestId('game')).toHaveAttribute('data-moves', '0');
});

test('поражение по лимиту ходов и «Переиграть»', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/?unlock=all#/level/3');
  const level = LEVELS[2];
  if (level === undefined) throw new Error('no level 3');
  // Квадрат из (3,2) гоняем влево-вправо: ходы тратятся, цвета не собираются.
  for (let i = 0; i < level.limit; i += 1) {
    if ((await page.getByTestId('game').getAttribute('data-status')) !== 'playing') break;
    await swipeSquare(page, i % 2 === 0 ? 3 : 2, 2, i % 2 === 0 ? 'left' : 'right');
    await idle(page);
  }
  await expect(page.getByTestId('popup-lose')).toBeVisible({ timeout: 10_000 });
  await page.locator('[data-action="replay"]').click();
  await expect(page.getByTestId('popup-lose')).toHaveCount(0);
  await expect(page.getByTestId('game')).toHaveAttribute('data-moves', '0');
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
    }
    await page.close();
  }
});
