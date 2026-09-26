import { expect, test, type Page } from '@playwright/test';
import { solve } from '../src/engine/flipEngine.ts';
import { LEVELS } from '../src/levels/levels.ts';

async function idle(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="game"]:not([data-busy]), [data-testid="game"][data-status="won"], [data-testid="game"][data-status="failed"]')).toHaveCount(1);
}

/** Проходит уровень решением солвера, тапая блоки по очереди. */
async function solveLevel(page: Page, id: number): Promise<void> {
  const level = LEVELS[id - 1];
  if (level === undefined) throw new Error(`no level ${String(id)}`);
  const solution = solve(level.blocks, level.moveLimit);
  if (solution === null) throw new Error(`level ${String(id)} unsolvable`);
  for (const blockId of solution) {
    await page.locator(`[data-testid="block-${blockId}"]`).click();
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

test('недопустимый тап: упёршийся блок не тратит ход', async ({ page }) => {
  // Уровень 2: '2' и '3' стоят друг напротив друга — тап по любому недопустим.
  await page.goto('/?unlock=all#/level/2');
  await page.getByTestId('block-2').click();
  await page.waitForTimeout(300);
  await expect(page.getByTestId('game')).toHaveAttribute('data-moves', '0');
});

test('ловушка: приманка проигрывает уровень 3, «Ходов нет»', async ({ page }) => {
  await page.goto('/?unlock=all#/level/3');
  await page.getByTestId('block-4').click(); // exit-ready приманка, но убивает уровень (§6)
  await idle(page);
  // Дальше в этой раскладке ходов не остаётся — доигрываем до явного стопа.
  for (let i = 0; i < 6; i += 1) {
    const status = await page.getByTestId('game').getAttribute('data-status');
    if (status !== 'playing') break;
    const ids = await page.locator('.block').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset['testid']?.replace('block-', '')));
    for (const id of ids) {
      const before = await page.getByTestId('game').getAttribute('data-moves');
      await page.getByTestId(`block-${String(id)}`).click();
      await page.waitForTimeout(700);
      const after = await page.getByTestId('game').getAttribute('data-moves');
      if (after !== before) break;
    }
  }
  await expect(page.getByTestId('popup-lose')).toBeVisible();
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
