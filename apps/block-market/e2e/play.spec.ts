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

/** Тащит фигуру из места `slot` в клетку (col, row) поля; true, если ход принят. */
async function dragTo(page: Page, slot: number, col: number, row: number): Promise<boolean> {
  const now = await page.locator(`[data-testid="slot-${String(slot)}"]`).boundingBox();
  const board = await page.locator('[data-testid="board"]').boundingBox();
  if (now === null || board === null) throw new Error('no boxes');
  const cell = (board.width - 16 - 7 * 3) / 8;
  const step = cell + 3;
  const x = board.x + 8 + col * step + cell / 2;
  const y = board.y + 8 + row * step + cell / 2 + 44 + cell * 1.5;
  await page.mouse.move(now.x + now.width / 2, now.y + now.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(60);
  return (await attr(page, 'busy')) === '1';
}

/** Ставит текущую фигуру куда получится. Если места нет и есть монеты — пересдаёт. */
async function placeSomewhere(page: Page): Promise<void> {
  await waitIdle(page);
  if ((await attr(page, 'status')) !== 'playing') return;
  // ни одной фигуре некуда встать: пересдаём, пока есть монеты; без монет фигура сгорит сама
  while ((await attr(page, 'stuck')) === '1' && (await num(page, 'coins')) >= 2) {
    await page.locator('[data-testid="buy-reroll"]').click({ force: true });
    await waitIdle(page);
    if ((await attr(page, 'status')) !== 'playing') return;
  }
  const before = await num(page, 'used');
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
  // некуда встать и не удалось пересдать: ход не тратится
  expect(await num(page, 'used')).toBe(before);
}

async function closeHelp(page: Page): Promise<void> {
  await page.locator('[data-testid="popup-help"] [data-action="ok"]').click();
  await expect(page.locator('[data-testid="popup-help"]')).toHaveCount(0);
}

test('главный → игра → «Как играть» открылся сам → уровень 1 с 5 монетами', async ({ page }) => {
  await page.goto('/?seed=5#/');
  await expect(page.locator('[data-testid="home"]')).toBeVisible();
  await page.locator('[data-testid="play"]').click({ force: true });
  await expect(page.locator('[data-testid="popup-help"]')).toBeVisible();
  await closeHelp(page);
  await expect(game(page)).toHaveAttribute('data-level', '1');
  await expect(game(page)).toHaveAttribute('data-coins', '5');
  await expect(game(page)).toHaveAttribute('data-used', '0');
  await expect(page.locator('[data-testid="stat-coins"]')).toContainText('5');
  // второй заход «Как играть» уже не открывается сам
  await page.click('[data-testid="to-home"]');
  await page.locator('[data-testid="play"]').click({ force: true });
  await expect(game(page)).toBeVisible();
  await expect(page.locator('[data-testid="popup-help"]')).toHaveCount(0);
  await page.click('[data-testid="help"]');
  await expect(page.locator('[data-testid="popup-help"]')).toBeVisible();
});

test('фигура встаёт на поле перетаскиванием и тратит один из 20 ходов', async ({ page }) => {
  await page.goto('/?seed=5#/play');
  await closeHelp(page);
  await placeSomewhere(page);
  await expect(game(page)).toHaveAttribute('data-used', '1');
  expect(await page.locator('[data-testid="board"] .tile:not(.c-9)').count()).toBeGreaterThanOrEqual(2);
});

test('на руках три фигуры, любую можно взять сразу; «Дальше» не показывается', async ({ page }) => {
  await page.goto('/?seed=5#/play');
  await closeHelp(page);
  await expect(page.locator('.slot:not(.empty)')).toHaveCount(3);
  await expect(page.getByText('Дальше')).toHaveCount(0);
  await page.locator('[data-testid="slot-1"]').click();
  await expect(game(page)).toHaveAttribute('data-sel', '1');
  await expect(page.locator('[data-testid="slot-1"]')).toHaveClass(/sel/);
  // тащим третью фигуру: ход принят, на её месте встала новая
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
  await page.goto('/?seed=5#/play');
  await closeHelp(page);
  const now = await page.locator('[data-testid="slot-0"]').boundingBox();
  const board = await page.locator('[data-testid="board"]').boundingBox();
  if (now === null || board === null) throw new Error('no boxes');
  // отпускаем за краем поля
  await page.mouse.move(now.x + now.width / 2, now.y + now.height / 2);
  await page.mouse.down();
  await page.mouse.move(board.x + board.width + 60, board.y + board.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect(game(page)).toHaveAttribute('data-used', '0');
  await expect(game(page)).toHaveAttribute('data-busy', '0');
});

test('покупки: поворот и зеркало по 2 монеты; без денег покупка не проходит', async ({ page }) => {
  await page.goto('/?seed=5#/play');
  await closeHelp(page);
  // seed 5: первая фигура Z — поворот меняет её
  await page.click('[data-testid="buy-rotate"]');
  await waitIdle(page);
  await expect(game(page)).toHaveAttribute('data-coins', '3');
  await page.click('[data-testid="buy-mirror"]');
  await waitIdle(page);
  await expect(game(page)).toHaveAttribute('data-coins', '1');
  await page.locator('[data-testid="buy-reroll"]').click({ force: true });
  await expect(game(page)).toHaveAttribute('data-coins', '1');
  await expect(page.locator('[data-testid="hint"]')).toContainText('Не хватает монет');
  await expect(game(page)).toHaveAttribute('data-used', '0');
});

test('замена: шторка показывает каталог, дорогое приглушено, покупка списывает цену', async ({ page }) => {
  await page.goto('/?seed=5#/play');
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
  await expect(game(page)).toHaveAttribute('data-piece', 'domino');
});

test('шторку можно закрыть без покупки', async ({ page }) => {
  await page.goto('/?seed=5#/play');
  await closeHelp(page);
  await page.click('[data-testid="buy-swap"]');
  await page.click('[data-testid="swap-close"]');
  await expect(page.locator('[data-testid="swap-sheet"]')).toHaveCount(0);
  await expect(game(page)).toHaveAttribute('data-coins', '5');
});

test('уровень без цели проходится: попап победы, «Дальше» ведёт на уровень 2 с тем же кошельком', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('/?seed=5&goal=0#/play');
  await closeHelp(page);
  for (let i = 0; i < 80 && (await attr(page, 'status')) === 'playing'; i += 1) await placeSomewhere(page);
  await expect(page.locator('[data-testid="popup-win"]')).toBeVisible({ timeout: 10_000 });
  const coins = await num(page, 'coins');
  await page.click('[data-testid="popup-win"] [data-action="next"]');
  await expect(game(page)).toHaveAttribute('data-level', '2');
  await expect(game(page)).toHaveAttribute('data-used', '0');
  await expect(game(page)).toHaveAttribute('data-coins', String(coins));
});

test('проигрыш: цель не набрана, «Новый забег» возвращает всё в начало', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('/?seed=5&goal=99#/play');
  await closeHelp(page);
  for (let i = 0; i < 80 && (await attr(page, 'status')) === 'playing'; i += 1) await placeSomewhere(page);
  await expect(page.locator('[data-testid="popup-lose"]')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-testid="popup-lose"]')).toContainText('Цель не набрана');
  await page.click('[data-testid="popup-lose"] [data-action="again"]');
  await expect(game(page)).toHaveAttribute('data-level', '1');
  await expect(game(page)).toHaveAttribute('data-used', '0');
  await expect(game(page)).toHaveAttribute('data-coins', '5');
  await expect(game(page)).toHaveAttribute('data-lines', '0');
});

test('лог пишет старт уровня и ход', async ({ page }) => {
  await page.goto('/?seed=5#/play');
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
    for (const url of ['/#/', '/?seed=5#/play']) {
      await page.goto(url);
      if (url.includes('play')) await closeHelp(page);
      const sizes = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth }));
      expect(sizes.sh).toBeLessThanOrEqual(sizes.ih);
      expect(sizes.sw).toBeLessThanOrEqual(sizes.iw);
    }
    const cell = await page.locator('.cell').first().boundingBox();
    expect(cell?.width ?? 0).toBeGreaterThanOrEqual(18);
    // всё игровое влезает в экран
    for (const id of ['slot-0', 'buy-swap', 'board']) {
      const box = await page.locator(`[data-testid="${id}"]`).boundingBox();
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(h);
    }
    await context.close();
  });
}
