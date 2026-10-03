import { expect, test, type Page } from '@playwright/test';

const game = (page: Page) => page.locator('[data-testid="game"]');
const attr = async (page: Page, name: string): Promise<string> => (await game(page).getAttribute(`data-${name}`)) ?? '';
const num = async (page: Page, name: string): Promise<number> => Number(await attr(page, name));

/** Ход закончился: ввод свободен или уровень закрыт (тогда busy держит попап). */
async function waitIdle(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const el = document.querySelector<HTMLElement>('[data-testid="game"]');
    return el !== null && (el.dataset['busy'] === '0' || el.dataset['status'] !== 'playing');
  });
}

const playing = async (page: Page): Promise<boolean> => (await attr(page, 'status')) === 'playing';

/** Тащит фигуру из места `slot` в клетку (col, row) поля; true, если ход принят. */
async function dragTo(page: Page, slot: number, col: number, row: number): Promise<boolean> {
  const from = await page.locator(`[data-testid="slot-${String(slot)}"]`).boundingBox();
  const board = await page.locator('[data-testid="board"]').boundingBox();
  if (from === null || board === null) throw new Error('no boxes');
  const cell = (board.width - 16 - 7 * 3) / 8;
  const step = cell + 3;
  const x = board.x + 8 + col * step + cell / 2;
  const y = board.y + 8 + row * step + cell / 2 + 44 + cell * 1.5;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(60);
  return (await attr(page, 'busy')) === '1';
}

const enabled = async (page: Page, id: string): Promise<boolean> =>
  (await page.locator(`[data-testid="${id}"]`).getAttribute('aria-disabled')) === 'false';

/** Ни одной фигуре некуда встать: пробуем повороты, зеркала и замену. Если игра не сожгла фигуру сама, выход есть. */
async function rescue(page: Page): Promise<void> {
  const hand = (await attr(page, 'hand')).split(',').length;
  for (let slot = 0; slot < hand && (await playing(page)) && (await attr(page, 'stuck')) === '1'; slot += 1) {
    await page.locator(`[data-testid="slot-${String(slot)}"]`).click();
    for (const id of ['buy-rotate', 'buy-rotate', 'buy-rotate', 'buy-mirror', 'buy-rotate', 'buy-rotate', 'buy-rotate']) {
      if (!(await playing(page)) || (await attr(page, 'stuck')) === '0') return;
      if (await enabled(page, id)) {
        await page.locator(`[data-testid="${id}"]`).click();
        await waitIdle(page);
      }
    }
  }
  for (const type of ['mono', 'domino']) {
    if (!(await playing(page)) || (await attr(page, 'stuck')) === '0') return;
    if (!(await enabled(page, 'buy-swap'))) return;
    await page.locator('[data-testid="buy-swap"]').click();
    const option = page.locator(`[data-testid="swap-option-${type}"]`);
    if ((await option.getAttribute('aria-disabled')) === 'false') {
      await option.click();
      await page.locator('[data-testid="swap-confirm"]').click();
      await waitIdle(page);
    } else await page.locator('[data-testid="swap-close"]').click();
  }
}

/** Ставит какую-нибудь фигуру куда получится. */
async function placeSomewhere(page: Page): Promise<void> {
  await waitIdle(page);
  if (!(await playing(page))) return;
  if ((await attr(page, 'stuck')) === '1') {
    await rescue(page);
    await waitIdle(page);
    if (!(await playing(page))) return;
  }
  const order = [3, 4, 2, 5, 1, 6, 0, 7];
  const hand = (await attr(page, 'hand')).split(',').length;
  for (const row of order) {
    for (const col of order) {
      for (let slot = 0; slot < hand; slot += 1) {
        if (await dragTo(page, slot, col, row)) {
          await waitIdle(page);
          return;
        }
      }
    }
  }
}

async function playThrough(page: Page): Promise<void> {
  for (let i = 0; i < 90 && (await playing(page)); i += 1) await placeSomewhere(page);
}

async function closeHelp(page: Page): Promise<void> {
  await page.locator('[data-testid="popup-help"] [data-action="ok"]').click();
  await expect(page.locator('[data-testid="popup-help"]')).toHaveCount(0);
}

test('главный → уровни → уровень 1 («Как играть» открылся сам) с 5 монетами и полным HUD', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.locator('[data-testid="home"]')).toBeVisible();
  await expect(page.locator('.home-art')).toBeVisible();
  await page.locator('[data-testid="play"]').click({ force: true });
  await expect(page.locator('[data-testid="levels"]')).toBeVisible();
  await page.click('[data-testid="level-1"]');
  await expect(page.locator('[data-testid="popup-help"]')).toBeVisible();
  await closeHelp(page);
  await expect(game(page)).toHaveAttribute('data-level', '1');
  await expect(game(page)).toHaveAttribute('data-coins', '5');
  await expect(game(page)).toHaveAttribute('data-used', '0');
  // сколько фигур показано и сколько осталось; сколько линий собрано и сколько ещё нужно; сколько денег
  await expect(page.locator('[data-testid="stat-pieces"]')).toContainText('3/20');
  await expect(page.locator('[data-testid="stat-pieces"]')).toContainText('17 left');
  await expect(page.locator('[data-testid="stat-lines"]')).toContainText('0/4');
  await expect(page.locator('[data-testid="stat-lines"]')).toContainText('4 to go');
  await expect(page.locator('[data-testid="stat-coins"]')).toContainText('5/10');
  await expect(page.getByText('Next')).toHaveCount(0);
});

test('экран уровней: пять карточек, открыт только первый, закрытый качается', async ({ page }) => {
  await page.goto('/#/levels');
  await expect(page.locator('.level-card')).toHaveCount(5);
  await expect(page.locator('[data-testid="level-1"]')).toHaveClass(/current/);
  for (const n of [2, 3, 4, 5]) await expect(page.locator(`[data-testid="level-${String(n)}"]`)).toHaveClass(/locked/);
  await page.click('[data-testid="level-3"]');
  await expect(page.locator('[data-testid="levels"]')).toBeVisible();
  await page.goto('/?unlock=all#/levels');
  for (const n of [2, 3, 4, 5]) await expect(page.locator(`[data-testid="level-${String(n)}"]`)).not.toHaveClass(/locked/);
});

test('фигура встаёт на поле перетаскиванием: показанных становится на одну больше', async ({ page }) => {
  await page.goto('/#/level/1');
  await closeHelp(page);
  await placeSomewhere(page);
  await expect(game(page)).toHaveAttribute('data-used', '1');
  await expect(page.locator('[data-testid="stat-pieces"]')).toContainText('4/20');
  await expect(page.locator('[data-testid="stat-pieces"]')).toContainText('16 left');
  expect(await page.locator('[data-testid="board"] .tile:not(.c-9)').count()).toBeGreaterThanOrEqual(2);
});

test('на руках три фигуры, любую можно взять сразу', async ({ page }) => {
  await page.goto('/#/level/1');
  await closeHelp(page);
  await expect(page.locator('.slot:not(.empty)')).toHaveCount(3);
  await page.locator('[data-testid="slot-1"]').click();
  await expect(game(page)).toHaveAttribute('data-sel', '1');
  await expect(page.locator('[data-testid="slot-1"]')).toHaveClass(/sel/);
  const before = (await attr(page, 'hand')).split(',');
  const board = await page.locator('[data-testid="board"]').boundingBox();
  const slot = await page.locator('[data-testid="slot-2"]').boundingBox();
  if (board === null || slot === null) throw new Error('no boxes');
  await page.mouse.move(slot.x + slot.width / 2, slot.y + slot.height / 2);
  await page.mouse.down();
  await page.mouse.move(board.x + board.width / 2, board.y + board.height * 0.65, { steps: 6 });
  await page.mouse.up();
  await waitIdle(page);
  await expect(game(page)).toHaveAttribute('data-used', '1');
  const after = (await attr(page, 'hand')).split(',');
  expect(after).toHaveLength(3);
  expect(after.slice(0, 2)).toEqual(before.slice(0, 2));
});

test('недопустимая постановка ход не тратит', async ({ page }) => {
  await page.goto('/#/level/1');
  await closeHelp(page);
  const from = await page.locator('[data-testid="slot-0"]').boundingBox();
  const board = await page.locator('[data-testid="board"]').boundingBox();
  if (from === null || board === null) throw new Error('no boxes');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(board.x + board.width + 60, board.y + board.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect(game(page)).toHaveAttribute('data-used', '0');
  await expect(game(page)).toHaveAttribute('data-busy', '0');
});

test('покупок три: поворот по 2 монеты; без денег покупка не проходит; пересдачи нет', async ({ page }) => {
  await page.goto('/#/level/1');
  await closeHelp(page);
  await expect(page.locator('.buy')).toHaveCount(3);
  await expect(page.locator('[data-testid="buy-reroll"]')).toHaveCount(0);
  await page.click('[data-testid="buy-rotate"]');
  await waitIdle(page);
  await expect(game(page)).toHaveAttribute('data-coins', '3');
  await page.click('[data-testid="buy-rotate"]');
  await waitIdle(page);
  await expect(game(page)).toHaveAttribute('data-coins', '1');
  await page.locator('[data-testid="buy-rotate"]').click({ force: true });
  await expect(game(page)).toHaveAttribute('data-coins', '1');
  await expect(page.locator('[data-testid="hint"]')).toContainText('Not enough coins');
  await expect(game(page)).toHaveAttribute('data-used', '0');
});

test('замена: шторка показывает каталог, дорогое приглушено, покупка списывает цену', async ({ page }) => {
  await page.goto('/#/level/1');
  await closeHelp(page);
  await page.click('[data-testid="buy-swap"]');
  await expect(page.locator('[data-testid="swap-sheet"]')).toBeVisible();
  await expect(page.locator('[data-testid="swap-option-I5"]')).toHaveClass(/off/);
  await expect(page.locator('[data-testid="swap-confirm"]')).toBeDisabled();
  await page.click('[data-testid="swap-option-domino"]');
  await expect(page.locator('[data-testid="swap-confirm"]')).toBeEnabled();
  await page.click('[data-testid="swap-confirm"]');
  await waitIdle(page);
  await expect(page.locator('[data-testid="swap-sheet"]')).toHaveCount(0);
  await expect(game(page)).toHaveAttribute('data-coins', '0');
  expect((await attr(page, 'hand')).split(',')).toContain('domino');
});

test('шторку можно закрыть без покупки', async ({ page }) => {
  await page.goto('/#/level/1');
  await closeHelp(page);
  await page.click('[data-testid="buy-swap"]');
  await page.click('[data-testid="swap-close"]');
  await expect(page.locator('[data-testid="swap-sheet"]')).toHaveCount(0);
  await expect(game(page)).toHaveAttribute('data-coins', '5');
});

test('победа: попап, «Следующий уровень» открывает уровень 2, на экране уровней 1 пройден', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('/?goal=0#/level/1');
  await closeHelp(page);
  await playThrough(page);
  await expect(page.locator('[data-testid="popup-win"]')).toBeVisible({ timeout: 10_000 });
  await page.click('[data-testid="popup-win"] [data-action="next"]');
  await expect(game(page)).toHaveAttribute('data-level', '2');
  await expect(game(page)).toHaveAttribute('data-coins', '5');
  await expect(game(page)).toHaveAttribute('data-used', '0');
  await page.click('[data-testid="to-home"]');
  await page.click('[data-testid="play"]', { force: true });
  await expect(page.locator('[data-testid="level-1"]')).toHaveClass(/done/);
  await expect(page.locator('[data-testid="level-2"]')).toHaveClass(/current/);
});

test('поражение: цель не набрана, «Переиграть» начинает уровень с той же руки', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('/?goal=99#/level/1');
  await closeHelp(page);
  const startHand = await attr(page, 'hand');
  await playThrough(page);
  await expect(page.locator('[data-testid="popup-lose"]')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-testid="popup-lose"]')).toContainText('Goal not reached');
  await page.click('[data-testid="popup-lose"] [data-action="again"]');
  await expect(game(page)).toHaveAttribute('data-level', '1');
  await expect(game(page)).toHaveAttribute('data-used', '0');
  await expect(game(page)).toHaveAttribute('data-coins', '5');
  await expect(game(page)).toHaveAttribute('data-lines', '0');
  await expect(game(page)).toHaveAttribute('data-hand', startHand);
});

test('после пятого уровня — финальный попап', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('/?unlock=all&goal=0#/level/5');
  await closeHelp(page);
  await playThrough(page);
  await expect(page.locator('[data-testid="popup-final"]')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-testid="popup-final"]')).toContainText('All levels complete');
});

test('лог пишет старт уровня и ход', async ({ page }) => {
  await page.goto('/#/level/1');
  await closeHelp(page);
  await placeSomewhere(page);
  const events = await page.evaluate(() => JSON.parse(localStorage.getItem('block-market:log') ?? '[]') as { type: string }[]);
  const types = events.map((e) => e.type);
  expect(types).toContain('level_start');
  expect(types).toContain('help_open');
  expect(types).toContain('place');
});

for (const [w, h] of [[360, 560], [375, 560], [390, 664], [430, 932]] as const) {
  test(`на ${String(w)}×${String(h)} нет прокрутки и поле не меньше 18 px на клетку`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    for (const url of ['/#/', '/#/levels', '/#/level/1']) {
      await page.goto(url);
      if (url.endsWith('level/1')) await closeHelp(page);
      const sizes = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth }));
      expect(sizes.sh).toBeLessThanOrEqual(sizes.ih);
      expect(sizes.sw).toBeLessThanOrEqual(sizes.iw);
    }
    const cell = await page.locator('.cell').first().boundingBox();
    expect(cell?.width ?? 0).toBeGreaterThanOrEqual(18);
    for (const id of ['slot-0', 'buy-swap', 'board', 'stat-lines']) {
      const box = await page.locator(`[data-testid="${id}"]`).boundingBox();
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(h);
    }
    await context.close();
  });
}
