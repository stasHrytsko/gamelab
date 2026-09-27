import { expect, test, type Page } from '@playwright/test';
import { roomFromMap, safeSequence } from '../../../tools/excavation-solver.mjs';
import { readFileSync } from 'node:fs';
import type { Level } from '../src/engine/types.ts';

// levels.json читается напрямую: раннер Playwright грузит TS как ESM, а JSON-модуль без атрибута там не импортируется.
const LEVELS = JSON.parse(readFileSync(new URL('../src/levels/levels.json', import.meta.url), 'utf8')) as Level[];

const game = (page: Page) => page.getByTestId('game');

async function roomOf(page: Page, id: number) {
  const level = LEVELS[id - 1];
  if (level === undefined) throw new Error(`no level ${String(id)}`);
  const layout = Number(await game(page).getAttribute('data-layout'));
  const map = level.layouts[layout]?.map;
  if (map === undefined) throw new Error('no layout');
  return { level, room: roomFromMap(map, level.traps) };
}

const cellId = (cols: number, i: number): string => `cell-${String(Math.floor(i / cols))}-${String(i % cols)}`;

/** Открывает все плиты, которые логика открывает без единой догадки. */
async function digSafe(page: Page, id: number): Promise<void> {
  const { room } = await roomOf(page, id);
  for (const i of safeSequence(room)) {
    await page.getByTestId(cellId(room.cols, i)).click();
  }
}

async function dismissHelp(page: Page): Promise<void> {
  await expect(page.getByTestId('popup-help')).toBeVisible();
  await page.locator('[data-action="ok"]').click();
  await expect(page.getByTestId('popup-help')).toHaveCount(0);
}

test('с главного до победы на уровне 1 и открытия уровня 2', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('home')).toBeVisible();
  await page.getByTestId('play').click({ force: true });
  await expect(page.getByTestId('level-2')).toHaveClass(/locked/);
  await page.getByTestId('level-1').click();
  await dismissHelp(page);
  await expect(page.getByTestId('take')).toHaveAttribute('data-block', 'no_exit');

  // Уровень 1 логика открывает целиком — победа без «Забрать», на три звезды.
  await digSafe(page, 1);
  await expect(game(page)).toHaveAttribute('data-status', 'won');
  await expect(page.getByTestId('popup-win')).toBeVisible();
  await expect(page.getByTestId('popup-win').locator('.stars-big')).toHaveAttribute('data-stars', '3');
  await page.locator('[data-action="next"]').click();
  await expect(game(page)).toHaveAttribute('data-level', '2');
  await expect(page.getByTestId('popup-help')).toHaveCount(0);

  await page.getByTestId('to-levels').click();
  await expect(page.getByTestId('best-1')).toHaveAttribute('data-stars', '3');
  await expect(page.getByTestId('level-2')).toHaveClass(/current/);
});

test('все пять уровней проходятся без риска, после пятого — финальный попап', async ({ page }) => {
  test.setTimeout(180_000);
  for (const id of [1, 2, 3, 4, 5]) {
    await page.goto(`/?unlock=all#/level/${String(id)}`);
    if (id === 1) await dismissHelp(page);
    await expect(game(page)).toHaveAttribute('data-level', String(id));
    await digSafe(page, id);
    await expect(game(page)).toHaveAttribute('data-exit', 'true');
    if (id > 1) {
      await expect(game(page)).toHaveAttribute('data-status', 'playing');
      await expect(game(page)).toHaveAttribute('data-stars', '1');
      await expect(page.getByTestId('take')).toHaveClass(/on/);
      await page.getByTestId('take').click();
    }
    await expect(page.getByTestId(id === 5 ? 'popup-final' : 'popup-win')).toBeVisible();
  }
});

test('«Забрать» до выхода не срабатывает; тап по открытой плите ничего не меняет', async ({ page }) => {
  await page.goto('/?unlock=all#/level/3');
  await page.getByTestId('take').click();
  await page.waitForTimeout(350);
  await expect(game(page)).toHaveAttribute('data-status', 'playing');
  await expect(page.getByTestId('take')).toContainText('Найди выход');

  const { room } = await roomOf(page, 3);
  const first = safeSequence(room).find((i) => (room.clue[i] ?? 0) > 0);
  if (first === undefined) throw new Error('no numbered safe tile');
  await page.getByTestId(cellId(room.cols, first)).click();
  const gold = await game(page).getAttribute('data-gold');
  expect(Number(gold)).toBe(room.clue[first]);
  await page.getByTestId(cellId(room.cols, first)).click();
  await page.getByTestId(cellId(room.cols, room.entrance)).click();
  await expect(game(page)).toHaveAttribute('data-gold', String(gold));
});

test('ловушка сжигает золото; «Переиграть» — следующая раскладка с нуля', async ({ page }) => {
  await page.goto('/?unlock=all#/level/3');
  await expect(game(page)).toHaveAttribute('data-layout', '0');
  const { room } = await roomOf(page, 3);
  const safe = safeSequence(room).slice(0, 4);
  for (const i of safe) await page.getByTestId(cellId(room.cols, i)).click();
  const trap = room.trap.findIndex(Boolean);
  await page.getByTestId(cellId(room.cols, trap)).click();
  await expect(game(page)).toHaveAttribute('data-status', 'failed');
  await expect(game(page)).toHaveAttribute('data-gold', '0');
  await expect(page.getByTestId('popup-lose')).toBeVisible();
  await expect(page.getByTestId('popup-lose')).toContainText('Ловушка!');
  // Комната раскрыта: все ловушки видны.
  await expect(page.locator('.cell.ghost-trap, .cell.trap-hit')).toHaveCount(room.traps);
  await page.locator('[data-action="replay"]').click();
  await expect(page.getByTestId('popup-lose')).toHaveCount(0);
  await expect(game(page)).toHaveAttribute('data-layout', '1');
  await expect(game(page)).toHaveAttribute('data-gold', '0');
  await expect(game(page)).toHaveAttribute('data-status', 'playing');
});

test('уровень 1: первое число подсвечивает соседей один раз', async ({ page }) => {
  await page.goto('/#/level/1');
  await dismissHelp(page);
  const { room } = await roomOf(page, 1);
  const first = safeSequence(room).find((i) => (room.clue[i] ?? 0) > 0);
  if (first === undefined) throw new Error('no numbered safe tile');
  await page.getByTestId(cellId(room.cols, first)).click();
  await expect(page.getByTestId('clue-tip')).toBeVisible();
  await expect(page.getByTestId('clue-tip')).toContainText(`+${String(room.clue[first])}`);
  await expect(page.locator('.cell.tip-ring').first()).toBeVisible();
  await expect(page.getByTestId('clue-tip')).toBeHidden({ timeout: 3000 });
  await page.getByTestId('restart').click();
  const next = await roomOf(page, 1);
  const again = safeSequence(next.room).find((i) => (next.room.clue[i] ?? 0) > 0);
  if (again === undefined) throw new Error('no numbered safe tile');
  await page.getByTestId(cellId(next.room.cols, again)).click();
  await page.waitForTimeout(200);
  await expect(page.getByTestId('clue-tip')).toBeHidden();
});

test('экран помещается без прокрутки (§7.1)', async ({ browser }) => {
  for (const [width, height] of [[360, 560], [375, 560], [390, 664], [430, 932]] as const) {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: true, hasTouch: true });
    for (const id of [1, 3, 5]) {
      await page.goto(`/?unlock=all#/level/${String(id)}`);
      if (id === 1) await dismissHelp(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      expect(overflow, `${String(width)}×${String(height)}, уровень ${String(id)}`).toBeLessThanOrEqual(0);
      const board = await page.getByTestId('board').boundingBox();
      const take = await page.getByTestId('take').boundingBox();
      expect(board, 'поле на экране').not.toBeNull();
      expect((take?.y ?? 0) + (take?.height ?? 0), `кнопка влезает ${String(width)}×${String(height)}`).toBeLessThanOrEqual(height);
      expect((board?.y ?? 0) + (board?.height ?? 0)).toBeLessThanOrEqual(take?.y ?? height);
    }
    await page.close();
  }
});
