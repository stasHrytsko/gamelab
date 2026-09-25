import { expect, test, type Page } from '@playwright/test';
import { Solver } from '../tools/solver.ts';

// В игре кубики — Math.random (§5). В тесте его подменяем генератором с
// зерном, чтобы прогон был воспроизводимым; сама игра об этом не знает.
async function seedRandom(page: Page, seed: number): Promise<void> {
  await page.addInitScript((initial) => {
    let s = initial;
    Math.random = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }, seed);
}

const solvers = new Map<number, Solver>();
const solverFor = (cap: number): Solver => {
  const found = solvers.get(cap);
  if (found !== undefined) return found;
  const created = new Solver(cap);
  solvers.set(cap, created);
  return created;
};

async function idle(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="game"]:not([data-busy]), [data-testid="game"][data-status="won"], [data-testid="game"][data-status="failed"]')).toHaveCount(1);
}

const numbers = (raw: string | null): number[] => (raw ?? '').split(',').map(Number);

async function cellWidth(page: Page): Promise<number> {
  const a = await page.locator('.slot[data-row="0"][data-col="0"]').boundingBox();
  const b = await page.locator('.slot[data-row="0"][data-col="1"]').boundingBox();
  if (a === null || b === null) throw new Error('no slots');
  return b.x - a.x;
}

/** Перетаскивает планку в руке так, чтобы её левый край встал в столбец x. */
async function dragHandTo(page: Page, x: number): Promise<void> {
  const hand = page.getByTestId('hand');
  const from = Number(await hand.getAttribute('data-x'));
  const box = await hand.boundingBox();
  if (box === null) throw new Error('no hand');
  const cell = await cellWidth(page);
  const sx = box.x + box.width / 2;
  const sy = box.y + box.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + (x - from) * cell, sy, { steps: 8 });
  await page.mouse.up();
}

/** Один ход идеального игрока через интерфейс: тап по кубику, перетаскивание. */
async function bestMove(page: Page, cap: number): Promise<void> {
  const game = page.getByTestId('game');
  const heights = numbers(await game.getAttribute('data-heights'));
  const dice = numbers(await game.getAttribute('data-dice'));
  const { move } = solverFor(cap).best(heights, dice);
  if (move === null) throw new Error('no move but game is playing');
  await page.getByTestId(`die-${String(dice.indexOf(move.length))}`).click();
  await dragHandTo(page, move.x);
  await idle(page);
}

/** Играет попытки подряд, пока уровень не пройден. Возвращает число попыток. */
async function playUntilWin(page: Page, cap: number, finalLevel = false): Promise<number> {
  const game = page.getByTestId('game');
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    await idle(page);
    while ((await game.getAttribute('data-status')) === 'playing') await bestMove(page, cap);
    if ((await game.getAttribute('data-status')) === 'won') {
      await expect(page.getByTestId(finalLevel ? 'popup-final' : 'popup-win')).toBeVisible();
      return attempt;
    }
    await expect(page.getByTestId('popup-lose')).toBeVisible();
    await page.locator('[data-action="replay"]').click();
    await expect(page.getByTestId('popup-lose')).toHaveCount(0);
  }
  throw new Error('no win in 12 attempts');
}

test('с главного до победы на уровне 1 и открытия уровня 2', async ({ page }) => {
  await seedRandom(page, 11);
  await page.goto('/');
  await page.getByTestId('play').click({ force: true });
  await expect(page.getByTestId('level-2')).toHaveClass(/locked/);
  await page.getByTestId('level-1').click();

  await expect(page.getByTestId('popup-help')).toBeVisible();
  await page.locator('[data-action="ok"]').click();

  await playUntilWin(page, 2);
  await page.locator('[data-action="next"]').click();
  await expect(page.getByTestId('game')).toHaveAttribute('data-level', '2');
  // «Как играть» сам открывается только один раз.
  await expect(page.getByTestId('popup-help')).toHaveCount(0);

  await page.getByTestId('to-levels').click();
  await expect(page.getByTestId('level-1').locator('.check')).toBeVisible();
  await expect(page.getByTestId('level-2')).toHaveClass(/current/);
});

test('все пять уровней проходятся ходами солвера', async ({ page }) => {
  test.setTimeout(300_000);
  await seedRandom(page, 5);
  for (const id of [1, 2, 3, 4, 5]) {
    await page.goto(`/?unlock=all#/level/${String(id)}`);
    if (id === 1) await page.locator('[data-action="ok"]').click();
    await expect(page.getByTestId('game')).toHaveAttribute('data-level', String(id));
    await playUntilWin(page, id + 1, id === 5);
  }
  await expect(page.getByTestId('popup-final')).toContainText('Все уровни пройдены');
});

test('поражение no_fit и переигровка с новым броском', async ({ page }) => {
  await seedRandom(page, 3);
  await page.goto('/?unlock=all#/level/5');
  const game = page.getByTestId('game');
  // Жадно кладём самое длинное число в самую левую позицию — быстро ломает поверхность.
  for (let turn = 0; turn < 40 && (await game.getAttribute('data-status')) === 'playing'; turn += 1) {
    await idle(page);
    const dice = numbers(await game.getAttribute('data-dice'));
    const order = dice.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
    let placed = false;
    for (const { i } of order) {
      const die = page.getByTestId(`die-${String(i)}`);
      if (await die.evaluate((el) => el.classList.contains('dead'))) continue;
      await die.click();
      await dragHandTo(page, Number(await page.getByTestId('hand').getAttribute('data-x')));
      placed = true;
      break;
    }
    if (!placed) break;
  }
  await expect(game).toHaveAttribute('data-status', 'failed');
  await expect(page.getByTestId('no-fit')).toBeVisible();
  await expect(page.getByTestId('popup-lose')).toContainText('Ни одно число не легло');
  await page.locator('[data-action="replay"]').click();
  await expect(page.getByTestId('popup-lose')).toHaveCount(0);
  await expect(game).toHaveAttribute('data-heights', '0,0,0,0,0,0');
  await expect(game).toHaveAttribute('data-status', 'playing');
});

test('невалидная позиция ничего не тратит, повторный тап снимает выбор', async ({ page }) => {
  await seedRandom(page, 21);
  await page.goto('/?unlock=all#/level/3');
  const game = page.getByTestId('game');
  await idle(page);
  // Первый ход: кладём самое короткое число в столбец 0, чтобы появилась ступенька.
  const dice = numbers(await game.getAttribute('data-dice'));
  const shortest = dice.indexOf(Math.min(...dice));
  await page.getByTestId(`die-${String(shortest)}`).click();
  await dragHandTo(page, 0);
  await idle(page);
  const before = await game.getAttribute('data-heights');
  const planks = await game.getAttribute('data-planks');

  // Планку длиной ≥ 2 тянем на ступеньку (столбцы 0..): позиция невалидна.
  const next = numbers(await game.getAttribute('data-dice'));
  const long = next.findIndex((v) => v >= 2);
  expect(long).toBeGreaterThanOrEqual(0);
  {
    await page.getByTestId(`die-${String(long)}`).click();
    const hand = page.getByTestId('hand');
    const from = Number(await hand.getAttribute('data-x'));
    const cell = await cellWidth(page);
    const box = await hand.boundingBox();
    if (box === null) throw new Error('no hand');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - (from + 1) * cell, box.y + box.height / 2, { steps: 6 });
    await expect(hand).toHaveClass(/invalid/);
    await page.mouse.up();
    await idle(page);
    await expect(game).toHaveAttribute('data-heights', before ?? '');
    await expect(game).toHaveAttribute('data-planks', planks ?? '');
    await expect(hand).not.toHaveClass(/invalid/);
  }

  // Повторный тап по выбранному кубику убирает планку из руки.
  const sel = page.locator('.die.selected');
  await expect(sel).toHaveCount(1);
  await sel.click();
  await expect(page.getByTestId('hand')).toHaveCount(0);
});

test('перетаскивание пальцем (touch) кладёт планку', async ({ page }) => {
  await seedRandom(page, 8);
  await page.goto('/?unlock=all#/level/2');
  await idle(page);
  await page.getByTestId('die-0').click();
  const hand = page.getByTestId('hand');
  const box = await hand.boundingBox();
  if (box === null) throw new Error('no hand');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', px: number, py: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: px, y: py }] });
  await touch('touchStart', x, y);
  for (let i = 1; i <= 4; i += 1) await touch('touchMove', x + i, y);
  await touch('touchEnd', x + 4, y);
  await idle(page);
  await expect(page.getByTestId('game')).toHaveAttribute('data-planks', '1');
});
