import { expect, test, type Page } from '@playwright/test';
import { createState, legalSteps, modesOf, move } from '../src/engine/forwardEngine.ts';
import { solve } from '../src/engine/solver.ts';
import { LEVELS } from '../src/levels/levels.ts';

const testid = (page: Page, id: string) => page.locator(`[data-testid="${id}"]`);
const idle = (page: Page) => expect(testid(page, 'game')).not.toHaveAttribute('data-busy', '');

/** Играет решение солвера: тапает клетки, а при выборе — кнопку «Вперёд» или «Назад». */
async function playSolution(page: Page, levelIndex: number): Promise<void> {
  const level = LEVELS[levelIndex]!;
  const best = solve({ hero: level.hero, enemies: level.enemies }, level.moveLimit)!;
  let state = createState(level);
  for (const action of best.path) {
    const info = legalSteps(state).find((s) => s.dir === action.dir)!;
    await testid(page, `cell-${String(info.to.row)}-${String(info.to.col)}`).click();
    if (modesOf(info).length === 2) await testid(page, action.mode === 'forward' ? 'choice-forward' : 'choice-back').click();
    state = move(state, action.dir, action.mode)!.state;
    await expect(testid(page, 'game')).toHaveAttribute('data-moves', String(state.moves));
    await idle(page);
  }
}

test('главный → уровни → уровень 1 → победа → уровень 2 открыт', async ({ page }) => {
  await page.goto('/');
  await testid(page, 'play').click({ force: true }); // кнопка дышит, Playwright считает её нестабильной
  await expect(testid(page, 'levels')).toBeVisible();
  await expect(testid(page, 'level-2')).toHaveClass(/locked/);
  await testid(page, 'level-1').click();
  await expect(testid(page, 'popup-help')).toBeVisible(); // «Как играть» открылось само
  await testid(page, 'popup-help').getByText('Понятно!').click();
  await playSolution(page, 0);
  await expect(testid(page, 'popup-win')).toBeVisible();
  await testid(page, 'popup-win').getByText('К уровням').click();
  await expect(testid(page, 'level-2')).not.toHaveClass(/locked/);
});

test('все пять уровней проходятся решением солвера, после пятого — финал', async ({ page }) => {
  await page.goto('/?unlock=all#/level/1');
  await testid(page, 'popup-help').getByText('Понятно!').click();
  for (let i = 0; i < LEVELS.length; i += 1) {
    await expect(testid(page, 'game')).toHaveAttribute('data-level', String(i + 1));
    await playSolution(page, i);
    if (i < LEVELS.length - 1) {
      await testid(page, 'popup-win').getByText('Следующий уровень').click();
    } else {
      await expect(testid(page, 'popup-final')).toBeVisible();
    }
  }
});

test('недопустимый тап не тратит ход', async ({ page }) => {
  await page.goto('/?unlock=all#/level/3');
  await expect(testid(page, 'game')).toHaveAttribute('data-moves', '0');
  await testid(page, 'cell-4-4').click(); // далеко от героя
  await testid(page, 'enemy-0').click({ force: true }); // по врагу
  await expect(testid(page, 'game')).toHaveAttribute('data-moves', '0');
  await expect(testid(page, 'game')).toHaveAttribute('data-status', 'playing');
});

test('проигрыш жадной стратегией и «Переиграть» возвращают уровень в начало', async ({ page }) => {
  await page.goto('/?unlock=all#/level/3');
  const level = LEVELS[2]!;
  let state = createState(level);
  while (state.status === 'playing') {
    // жадный выбор: максимум врагов за шаг
    const options = legalSteps(state).flatMap((info) => modesOf(info).map((mode) => ({ info, mode, n: mode === 'forward' ? info.forward.length : mode === 'back' ? info.back.length : 0 })));
    const best = options.sort((a, b) => b.n - a.n)[0]!;
    await testid(page, `cell-${String(best.info.to.row)}-${String(best.info.to.col)}`).click();
    if (modesOf(best.info).length === 2) await testid(page, best.mode === 'forward' ? 'choice-forward' : 'choice-back').click();
    state = move(state, best.info.dir, best.mode)!.state;
    await expect(testid(page, 'game')).toHaveAttribute('data-moves', String(state.moves));
    await idle(page);
  }
  expect(state.status).toBe('failed');
  await expect(testid(page, 'popup-lose')).toBeVisible();
  await testid(page, 'popup-lose').getByText('Переиграть').click();
  await expect(testid(page, 'game')).toHaveAttribute('data-moves', '0');
  await expect(testid(page, 'game')).toHaveAttribute('data-enemies', String(level.enemies.length));
});

for (const [w, h] of [[360, 560], [375, 560], [390, 664], [430, 932]] as const) {
  test(`без прокрутки на ${String(w)}×${String(h)}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    for (const hash of ['#/', '#/levels', '#/level/5']) {
      await page.goto(`/?unlock=all${hash}`);
      if (hash === '#/level/5') await expect(testid(page, 'board')).toBeVisible();
      const overflow = await page.evaluate(() => ({
        x: document.documentElement.scrollWidth - window.innerWidth,
        y: document.documentElement.scrollHeight - window.innerHeight,
      }));
      expect(overflow.x).toBeLessThanOrEqual(0);
      expect(overflow.y).toBeLessThanOrEqual(0);
    }
    const box = await testid(page, 'board').boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(w);
  });
}
