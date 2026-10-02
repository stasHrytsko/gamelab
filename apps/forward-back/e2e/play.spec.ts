import { expect, test, type Page } from '@playwright/test';
import { createState, legalSteps, modesOf, move } from '../src/engine/forwardEngine.ts';
import type { Dir, GameState, Mode } from '../src/engine/types.ts';
import { solve } from '../src/engine/solver.ts';
import { LEVELS } from '../src/levels/levels.ts';

const testid = (page: Page, id: string) => page.locator(`[data-testid="${id}"]`);
const idle = (page: Page) => expect(testid(page, 'game')).not.toHaveAttribute('data-busy', '');

/** Один тап на ход: ход со взятием — тап по первому врагу линии, обычный шаг — тап по клетке. */
async function tapMove(page: Page, state: GameState, dir: Dir, mode: Mode): Promise<GameState> {
  const info = legalSteps(state).find((s) => s.dir === dir)!;
  const ids = mode === 'forward' ? info.forward : mode === 'back' ? info.back : [];
  if (ids.length > 0) await testid(page, `enemy-${ids[0]!}`).click();
  else await testid(page, `cell-${String(info.to.row)}-${String(info.to.col)}`).click();
  const next = move(state, dir, mode)!.state;
  await expect(testid(page, 'game')).toHaveAttribute('data-moves', String(next.moves));
  await idle(page);
  return next;
}

/** Играет решение солвера. */
async function playSolution(page: Page, levelIndex: number): Promise<void> {
  const level = LEVELS[levelIndex]!;
  const best = solve({ hero: level.hero, enemies: level.enemies }, level.moveLimit)!;
  let state = createState(level);
  for (const action of best.path) state = await tapMove(page, state, action.dir, action.mode);
}

test('главный → уровни → уровень 1 → победа → уровень 2 открыт', async ({ page }) => {
  await page.goto('/?lock=1'); // последовательное открытие уровней
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

test('по умолчанию все уровни открыты сразу', async ({ page }) => {
  await page.goto('/#/levels');
  for (let n = 1; n <= LEVELS.length; n += 1) await expect(testid(page, `level-${String(n)}`)).not.toHaveClass(/locked/);
  await testid(page, 'level-5').click();
  await expect(testid(page, 'game')).toHaveAttribute('data-level', '5');
});

test('тап по врагу сразу делает ход: шаг и линия выбираются сами', async ({ page }) => {
  await page.goto('/#/level/3');
  // Уровень 3: герой (2,2); враги (2,0),(2,1) позади и (2,4) впереди. Тап по (2,1) = шаг вправо и рывок.
  await testid(page, 'enemy-1').click();
  await expect(testid(page, 'game')).toHaveAttribute('data-moves', '1');
  await expect(testid(page, 'game')).toHaveAttribute('data-enemies', '1');
});

test('клетка с двумя вариантами не делает ход, а просит выбрать врага', async ({ page }) => {
  await page.goto('/#/level/3');
  await testid(page, 'cell-2-3').click();
  await expect(testid(page, 'game')).toHaveAttribute('data-moves', '0');
  await expect(testid(page, 'hint')).toContainText('Тапни врага');
});

test('удержание показывает предпросмотр, а уход пальцем отменяет ход', async ({ page }) => {
  await page.goto('/#/level/3');
  const enemy = (await testid(page, 'enemy-1').boundingBox())!;
  const empty = (await testid(page, 'cell-4-4').boundingBox())!;
  await page.mouse.move(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
  await page.mouse.down();
  await expect(testid(page, 'enemy-0')).toHaveClass(/doomed-back/); // вся линия рывка
  await expect(page.locator('.chain')).toHaveCount(1);
  await page.mouse.move(empty.x + empty.width / 2, empty.y + empty.height / 2, { steps: 4 });
  await expect(testid(page, 'enemy-0')).not.toHaveClass(/doomed/);
  await page.mouse.up();
  await expect(testid(page, 'game')).toHaveAttribute('data-moves', '0');
});

test('отмена хода возвращает врагов и счётчик', async ({ page }) => {
  await page.goto('/#/level/3');
  await expect(testid(page, 'undo')).toBeDisabled();
  await testid(page, 'enemy-1').click();
  await expect(testid(page, 'game')).toHaveAttribute('data-moves', '1');
  await idle(page);
  await testid(page, 'undo').click();
  await expect(testid(page, 'game')).toHaveAttribute('data-moves', '0');
  await expect(testid(page, 'game')).toHaveAttribute('data-enemies', '3');
  await expect(testid(page, 'enemy-0')).toBeVisible();
});

test('все пять уровней проходятся решением солвера, после пятого — финал', async ({ page }) => {
  await page.goto('/#/level/1');
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
  await page.goto('/#/level/4');
  await expect(testid(page, 'game')).toHaveAttribute('data-moves', '0');
  await testid(page, 'cell-4-4').click(); // далеко от героя
  await testid(page, 'enemy-5').click({ force: true }); // по врагу, до которого не достать
  await expect(testid(page, 'game')).toHaveAttribute('data-moves', '0');
  await expect(testid(page, 'game')).toHaveAttribute('data-status', 'playing');
});

test('проигрыш жадной стратегией: «Отменить ход» и «Переиграть»', async ({ page }) => {
  await page.goto('/#/level/4');
  const level = LEVELS[3]!;
  let state = createState(level);
  while (state.status === 'playing') {
    // жадный выбор: максимум врагов за шаг
    const options = legalSteps(state).flatMap((info) => modesOf(info).map((mode) => ({ info, mode, n: mode === 'forward' ? info.forward.length : mode === 'back' ? info.back.length : 0 })));
    const best = options.sort((a, b) => b.n - a.n)[0]!;
    state = await tapMove(page, state, best.info.dir, best.mode);
  }
  expect(state.status).toBe('failed');
  await expect(testid(page, 'popup-lose')).toBeVisible();
  await testid(page, 'popup-lose').getByText('Отменить ход').click();
  await expect(testid(page, 'game')).toHaveAttribute('data-status', 'playing');
  await expect(testid(page, 'game')).toHaveAttribute('data-moves', String(level.moveLimit - 1));
  await testid(page, 'restart').click();
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
