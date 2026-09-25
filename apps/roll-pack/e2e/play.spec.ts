import { expect, test, type Page } from '@playwright/test';
import { normalize, parseMap, solve } from '../src/engine/packEngine.ts';
import type { Point } from '../src/engine/types.ts';
import { LEVELS } from '../src/levels/levels.ts';

async function idle(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="game"]:not([data-busy]), [data-testid="game"][data-status="won"], [data-testid="game"][data-status="failed"]')).toHaveCount(1);
}

async function step(page: Page): Promise<number> {
  const a = await page.locator('.cell[data-r="0"][data-c="0"]').boundingBox();
  const b = await page.locator('.cell[data-r="0"][data-c="1"]').boundingBox();
  if (a === null || b === null) throw new Error('no board');
  return b.x - a.x;
}

/** Собрать фигуру в конструкторе и перетащить её так, чтобы она заняла клетки cells. */
async function placePiece(page: Page, cells: readonly Point[], numberIndex: number): Promise<void> {
  await page.getByTestId(`num-${String(numberIndex)}`).click();
  const shape = normalize(cells);
  for (const [r, c] of shape) await page.getByTestId(`b-${String(r)}-${String(c)}`).click();
  await expect(page.locator('.tray.ready')).toHaveCount(1);
  const grab = shape[0] as Point;
  const r0 = Math.min(...cells.map((p) => p[0]));
  const c0 = Math.min(...cells.map((p) => p[1]));
  const from = await page.getByTestId(`b-${String(grab[0])}-${String(grab[1])}`).boundingBox();
  const to = await page.locator(`.cell[data-r="${String(r0 + grab[0])}"][data-c="${String(c0 + grab[1])}"]`).boundingBox();
  if (from === null || to === null) throw new Error('no drag points');
  const lift = (await step(page)) * 1.2;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 + lift, { steps: 10 });
  await page.mouse.up();
  await idle(page);
}

/** Проходит уровень решением солвера. */
async function solveLevel(page: Page, id: number): Promise<void> {
  const level = LEVELS[id - 1];
  if (level === undefined) throw new Error(`no level ${String(id)}`);
  const pieces = solve(parseMap(level.map), level.numbers);
  if (pieces === null) throw new Error(`level ${String(id)} unsolvable`);
  const used = level.numbers.map(() => false);
  for (const piece of pieces) {
    const i = level.numbers.findIndex((n, j) => n === piece.length && !used[j]);
    used[i] = true;
    await placePiece(page, piece, i);
  }
}

test('с главного до победы на уровне 1 и открытия уровня 2', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('home')).toContainText('Build');
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
  test.setTimeout(180_000);
  for (const id of [1, 2, 3, 4, 5]) {
    await page.goto(`/?unlock=all#/level/${String(id)}`);
    if (id === 1) await page.locator('[data-action="ok"]').click();
    await expect(page.getByTestId('game')).toHaveAttribute('data-level', String(id));
    await solveLevel(page, id);
    await expect(page.getByTestId(id === 5 ? 'popup-final' : 'popup-win')).toBeVisible();
  }
});

test('счётчик клеток в подсказке и «Очистить»', async ({ page }) => {
  await page.goto('/?unlock=all#/level/2');
  await page.getByTestId('num-5').click();
  await expect(page.getByTestId('count')).toHaveText('0/4');
  await page.getByTestId('b-0-0').click();
  await page.getByTestId('b-0-1').click();
  await expect(page.getByTestId('count')).toHaveText('2/4');
  await page.getByTestId('b-2-2').click();
  await page.getByTestId('b-3-3').click();
  await expect(page.getByTestId('hint')).toContainText('касаться сторонами');
  await expect(page.getByTestId('count')).toHaveText('4/4');
  // Пятую клетку не поставить.
  await page.getByTestId('b-1-0').click();
  await expect(page.getByTestId('count')).toHaveText('4/4');
  await page.getByTestId('clear').click();
  await expect(page.getByTestId('count')).toHaveText('0/4');
});

test('фигура на препятствие не встаёт и ход не тратится', async ({ page }) => {
  await page.goto('/?unlock=all#/level/2');
  // Квадрат 2×2 в левый верхний угол препятствия (2,2).
  await page.getByTestId('num-5').click();
  for (const [r, c] of [[0, 0], [0, 1], [1, 0], [1, 1]] as const) await page.getByTestId(`b-${String(r)}-${String(c)}`).click();
  const from = await page.getByTestId('b-0-0').boundingBox();
  const to = await page.locator('.cell[data-r="2"][data-c="2"]').boundingBox();
  if (from === null || to === null) throw new Error('no points');
  const lift = (await step(page)) * 1.2;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 + lift, { steps: 8 });
  await expect(page.locator('.cell.aim-bad').first()).toBeVisible();
  await page.mouse.up();
  await expect(page.getByTestId('hint')).toContainText('Сюда не встаёт');
  await expect(page.getByTestId('game')).toHaveAttribute('data-used', '0');
});

test('поражение: кусок, который не закрыть, и переигровка', async ({ page }) => {
  await page.goto('/?unlock=all#/level/2');
  // Т-фигура из 4 клеток отрезает угловую клетку (0,0): одну клетку не закрыть ничем.
  await placePiece(page, [[0, 1], [1, 0], [1, 1], [1, 2]], 5);
  await expect(page.getByTestId('popup-lose')).toBeVisible();
  await expect(page.locator('.cell.dead').first()).toBeVisible();
  await page.locator('[data-action="replay"]').click();
  await expect(page.getByTestId('popup-lose')).toHaveCount(0);
  await expect(page.getByTestId('game')).toHaveAttribute('data-used', '0');
});

test('экран помещается без прокрутки (§7.1)', async ({ browser }) => {
  for (const [width, height] of [[360, 560], [375, 560], [390, 664], [430, 932]] as const) {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: true, hasTouch: true });
    for (const id of [1, 3, 5]) {
      await page.goto(`/?unlock=all#/level/${String(id)}`);
      const ok = page.locator('[data-action="ok"]');
      if (await ok.count()) await ok.click();
      await page.getByTestId('num-0').click();
      const overflow = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      expect(overflow, `${String(width)}×${String(height)}, уровень ${String(id)}`).toBeLessThanOrEqual(0);
      const tray = await page.locator('.tray').boundingBox();
      expect((tray?.y ?? 0) + (tray?.height ?? 0)).toBeLessThanOrEqual(height);
    }
    await page.close();
  }
});

test('перетаскивание пальцем (touch)', async ({ page }) => {
  await page.goto('/?unlock=all#/level/2');
  await page.getByTestId('num-5').click();
  for (const [r, c] of [[0, 0], [0, 1], [0, 2], [0, 3]] as const) await page.getByTestId(`b-${String(r)}-${String(c)}`).click();
  const from = await page.getByTestId('b-0-0').boundingBox();
  const to = await page.locator('.cell[data-r="0"][data-c="0"]').boundingBox();
  if (from === null || to === null) throw new Error('no points');
  const lift = (await step(page)) * 1.2;
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const sx = from.x + from.width / 2;
  const sy = from.y + from.height / 2;
  const tx = to.x + to.width / 2;
  const ty = to.y + to.height / 2 + lift;
  await touch('touchStart', sx, sy);
  for (let i = 1; i <= 8; i += 1) await touch('touchMove', sx + ((tx - sx) * i) / 8, sy + ((ty - sy) * i) / 8);
  await touch('touchEnd', tx, ty);
  await idle(page);
  await expect(page.getByTestId('game')).toHaveAttribute('data-used', '1');
});
