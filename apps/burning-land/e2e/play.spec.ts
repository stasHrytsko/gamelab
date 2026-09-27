import { expect, test, type Page } from '@playwright/test';
import { greedyHouse, solve, type Move } from '../../../tools/burning-land-solver.mjs';
import { anyFits, cellsAt, centerOffset, createState, fits, nextBurn, place, rotateSlot, skipTurn, trayOf } from '../src/engine/fireEngine.ts';
import type { GameState, Level } from '../src/engine/types.ts';
import { LEVELS } from '../src/levels/levels.ts';

async function idle(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="game"]:not([data-busy]), [data-testid="game"][data-status="won"], [data-testid="game"][data-status="failed"]')).toHaveCount(1);
}

const level = (id: number): Level => {
  const l = LEVELS[id - 1];
  if (l === undefined) throw new Error(`no level ${String(id)}`);
  return l;
};

/** Перетаскивает фигуру слота так, чтобы её якорь встал в `row, col`: палец на клетку ниже центра фигуры (§4). */
async function drag(page: Page, slot: number, letter: Parameters<typeof centerOffset>[0], rot: number, row: number, col: number): Promise<void> {
  const [cr, cc] = centerOffset(letter, rot);
  const target = await page.getByTestId(`cell-${String(row + cr)}-${String(col + cc)}`).boundingBox();
  const from = await page.getByTestId(`slot-${String(slot)}`).boundingBox();
  if (target === null || from === null) throw new Error('no box');
  const x = target.x + target.width / 2;
  const y = target.y + target.height / 2 + target.height + 4;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 - 20, { steps: 3 });
  await page.mouse.move(x, y, { steps: 6 });
  await page.mouse.up();
}

/** Играет линию ходов через настоящий экран: повороты тапом, постановка перетаскиванием. */
async function playLine(page: Page, id: number, line: ReadonlyArray<Move | null>): Promise<void> {
  const lvl = level(id);
  let s: GameState = createState(lvl);
  for (const move of line) {
    if (s.status !== 'playing') break;
    if (!anyFits(lvl, s)) {
      s = (skipTurn(lvl, s) as { state: GameState }).state;
      await idle(page);
      continue;
    }
    const m = move ?? firstFit(lvl, s);
    for (let k = 0; k < m.rot; k += 1) {
      await page.getByTestId(`slot-${String(m.slot)}`).click();
      s = rotateSlot(lvl, s, m.slot) as GameState;
    }
    await expect(page.getByTestId(`slot-${String(m.slot)}`)).toHaveAttribute('data-rot', String(m.rot));
    await drag(page, m.slot, m.letter, m.rot, m.row, m.col);
    const r = place(lvl, s, m.slot, { row: m.row, col: m.col });
    if (r === null) throw new Error('illegal move in line');
    s = r.state;
    await idle(page);
    await expect(page.getByTestId('game')).toHaveAttribute('data-status', s.status);
  }
}

function firstFit(lvl: Level, s: GameState): Move {
  const letters = trayOf(lvl, s.turn);
  for (let slot = 0; slot < letters.length; slot += 1) {
    const letter = letters[slot];
    if (letter === undefined) continue;
    for (let row = 0; row < 8; row += 1) for (let col = 0; col < 8; col += 1) {
      const at = cellsAt(letter, 0, { row, col });
      if (at !== null && fits(s.cells, at)) return { letter, rot: 0, row, col, cells: at, slot };
    }
  }
  throw new Error('nothing fits');
}

const solverLine = (id: number): ReadonlyArray<Move | null> => solve(level(id)).line ?? [];

async function openLevel(page: Page, id: number): Promise<void> {
  await page.goto(`/?unlock=all#/level/${String(id)}`);
  if (id === 1) await page.locator('[data-action="ok"]').click();
  await expect(page.getByTestId('game')).toHaveAttribute('data-level', String(id));
  await expect(page.getByTestId('popup-help')).toHaveCount(0);
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

  await playLine(page, 1, solverLine(1));
  await expect(page.getByTestId('popup-win')).toBeVisible();
  await expect(page.getByTestId('popup-win')).toContainText('от огня');
  await expect(page.getByTestId('saved').locator('b')).toHaveText(/^\d+$/);
  await page.locator('[data-action="next"]').click();
  await expect(page.getByTestId('game')).toHaveAttribute('data-level', '2');
  await expect(page.getByTestId('popup-help')).toHaveCount(0);
  await expect(page.getByTestId('hint')).toHaveCount(0);

  await page.getByTestId('to-levels').click();
  await expect(page.getByTestId('level-1').locator('.check')).toBeVisible();
  await expect(page.getByTestId('level-2')).toHaveClass(/current/);
});

test('все пять уровней проходятся линией солвера, после пятого — финальный попап', async ({ page }) => {
  test.setTimeout(180_000);
  for (const id of [1, 2, 3, 4, 5]) {
    await openLevel(page, id);
    await playLine(page, id, solverLine(id));
    await expect(page.getByTestId(id === 5 ? 'popup-final' : 'popup-win')).toBeVisible();
  }
});

test('точки превью стоят на клетках следующего шага огня', async ({ page }) => {
  await openLevel(page, 3);
  const expected = [...nextBurn(createState(level(3)).cells)].sort((a, b) => a - b);
  const dots = await page.locator('.cell.dot').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid') ?? ''));
  const got = dots.map((t) => t.split('-').slice(1).map(Number)).map(([r, c]) => (r ?? 0) * 8 + (c ?? 0)).sort((a, b) => a - b);
  expect(got).toEqual(expected);
});

test('тап поворачивает фигуру и не тратит ход; отпускание на огонь не тратит ход', async ({ page }) => {
  await openLevel(page, 3);
  // Уровень 3, ход 1: O D T. Слот 1 — домино: тап → вертикально.
  await page.getByTestId('slot-1').click();
  await expect(page.getByTestId('slot-1')).toHaveAttribute('data-rot', '1');
  await expect(page.getByTestId('game')).toHaveAttribute('data-turn', '0');
  // Квадрат на огонь e8 (0,4): нельзя, фигура возвращается.
  await drag(page, 0, 'O', 0, 0, 3);
  await idle(page);
  await expect(page.getByTestId('game')).toHaveAttribute('data-turn', '0');
  await expect(page.getByTestId('cell-0-3')).toHaveAttribute('data-kind', 'grass');
  await expect(page.getByTestId('slot-0')).not.toHaveClass(/empty|lifted/);
  // Отпускание вне поля — тоже без хода.
  const slot = await page.getByTestId('slot-2').boundingBox();
  if (slot === null) throw new Error('no slot');
  await page.mouse.move(slot.x + slot.width / 2, slot.y + slot.height / 2);
  await page.mouse.down();
  await page.mouse.move(slot.x + slot.width / 2 + 40, slot.y + slot.height / 2 + 10, { steps: 4 });
  await page.mouse.up();
  await idle(page);
  await expect(page.getByTestId('game')).toHaveAttribute('data-turn', '0');
  // Правильная постановка тратит ход.
  await drag(page, 0, 'O', 0, 5, 5);
  await idle(page);
  await expect(page.getByTestId('game')).toHaveAttribute('data-turn', '1');
  await expect(page.getByTestId('cell-5-5')).toHaveAttribute('data-kind', 'wall');
});

test('повороты: 3 на ход, четвёртый тап фигуру не крутит; новый ход — снова 3', async ({ page }) => {
  await openLevel(page, 3);
  // Ход 1: O D T. Два тапа по T, один по D — повороты кончились.
  await page.getByTestId('slot-2').click();
  await page.getByTestId('slot-2').click();
  await page.getByTestId('slot-1').click();
  await expect(page.getByTestId('game')).toHaveAttribute('data-rotations-left', '0');
  await expect(page.getByTestId('rotations')).toHaveClass(/out/);
  await page.getByTestId('slot-2').click();
  await page.waitForTimeout(250);
  await expect(page.getByTestId('slot-2')).toHaveAttribute('data-rot', '2');
  await expect(page.getByTestId('game')).toHaveAttribute('data-turn', '0');
  await drag(page, 0, 'O', 0, 5, 5);
  await idle(page);
  await expect(page.getByTestId('game')).toHaveAttribute('data-rotations-left', '3');
  await expect(page.getByTestId('rotations').locator('b')).toHaveText('3');
});

test('ловушка: «отодвигай от ближайшего дома» проигрывает уровень 3, «Переиграть» возвращает старт', async ({ page }) => {
  await openLevel(page, 3);
  await playLine(page, 3, greedyHouse(level(3)).log);
  await expect(page.getByTestId('game')).toHaveAttribute('data-status', 'failed');
  await expect(page.getByTestId('popup-lose')).toBeVisible();
  await expect(page.getByTestId('popup-lose')).toContainText('Дом сгорел');
  await expect(page.getByTestId('houses')).toHaveClass(/alarm/);
  await page.locator('[data-action="replay"]').click();
  await expect(page.getByTestId('popup-lose')).toHaveCount(0);
  await expect(page.getByTestId('game')).toHaveAttribute('data-turn', '0');
  await expect(page.getByTestId('game')).toHaveAttribute('data-status', 'playing');
  await expect(page.getByTestId('houses').locator('b')).toHaveText('3/3');
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
      const next = await page.getByTestId('next-2').boundingBox();
      const tray = await page.getByTestId('slot-0').boundingBox();
      expect(board, 'поле на экране').not.toBeNull();
      expect((next?.y ?? 0) + (next?.height ?? 0), `ряд «Дальше» влезает ${String(width)}×${String(height)}`).toBeLessThanOrEqual(height);
      expect((board?.y ?? 0) + (board?.height ?? 0), `поле не залезает на трей ${String(width)}×${String(height)}`).toBeLessThanOrEqual(tray?.y ?? 0);
      const cell = await page.getByTestId('cell-0-0').boundingBox();
      expect(cell?.width ?? 0, 'клетка не меньше 32 px').toBeGreaterThanOrEqual(32);
    }
    await page.close();
  }
});
