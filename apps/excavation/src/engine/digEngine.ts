import type { GameState, Level, Stars, TapResult } from './types.ts';

// Правила §4–5 спеки. Чистые функции без DOM; тот же расчёт чисел, что в
// tools/excavation-solver.mjs (tests/levels.test.ts сверяет их).

export function neighbours(rows: number, cols: number, i: number): number[] {
  const r = Math.floor(i / cols);
  const c = i % cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push(nr * cols + nc);
    }
  }
  return out;
}

export function createState(level: Level, layout: number): GameState {
  const source = level.layouts[layout % level.layouts.length];
  if (source === undefined) throw new Error(`level ${String(level.id)}: no layouts`);
  const { rows, cols } = level;
  const cells = source.map.join('');
  if (source.map.length !== rows || cells.length !== rows * cols) throw new Error(`level ${String(level.id)}: bad map`);
  const trap = [...cells].map((ch) => ch === '*');
  const clue = trap.map((t, i) => (t ? -1 : neighbours(rows, cols, i).filter((j) => trap[j]).length));
  const entrance = cells.indexOf('E');
  const exit = cells.indexOf('X');
  if (entrance < 0 || exit < 0) throw new Error(`level ${String(level.id)}: no entrance or exit`);
  const open = trap.map((_, i) => i === entrance);
  return {
    level,
    layout: layout % level.layouts.length,
    rows,
    cols,
    trap,
    clue,
    open,
    entrance,
    exit,
    gold: 0,
    exitFound: false,
    status: 'playing',
    failReason: null,
    lostGold: 0,
    trapHit: -1,
  };
}

export const indexOf = (s: GameState, row: number, col: number): number => row * s.cols + col;

export function starsFor(level: Level, gold: number): Stars {
  return level.stars.filter((t) => gold >= t).length as Stars;
}

export const canTake = (s: GameState): boolean => s.status === 'playing' && s.exitFound && s.gold >= s.level.stars[0];

/** Закрытые безопасные плиты. */
export const safeLeft = (s: GameState): number => s.trap.filter((t, i) => !t && !s.open[i]).length;

/** Сумма чисел неоткрытых безопасных плит — «Осталось в комнате». */
export const goldLeft = (s: GameState): number =>
  s.clue.reduce((sum, v, i) => (!s.trap[i] && !s.open[i] ? sum + v : sum), 0);

/**
 * Тап по плите (§4). null — тап ничего не меняет: плита открыта, это вход,
 * найденный выход, или попытка уже кончилась.
 * Порядок (§5): открыть → ловушка? поражение → золото → выход → звёзды → расчистка → победа.
 */
export function tap(s: GameState, row: number, col: number): TapResult | null {
  if (s.status !== 'playing') return null;
  if (row < 0 || row >= s.rows || col < 0 || col >= s.cols) return null;
  const i = indexOf(s, row, col);
  if (s.open[i]) return null;
  const open = s.open.map((v, j) => v || j === i);
  if (s.trap[i]) {
    return {
      state: { ...s, open, status: 'failed', failReason: 'trap', lostGold: s.gold, gold: 0, trapHit: i },
      index: i,
      kind: 'trap',
      gained: 0,
      cleared: false,
    };
  }
  const gained = s.clue[i] ?? 0;
  const isExit = i === s.exit;
  let next: GameState = { ...s, open, gold: s.gold + gained, exitFound: s.exitFound || isExit };
  const cleared = safeLeft(next) === 0;
  if (cleared) next = { ...next, status: 'won' };
  return { state: next, index: i, kind: isExit ? 'exit' : 'safe', gained, cleared };
}

/** «Забрать» (§4). null — кнопка неактивна: выход не найден или нет первой звезды. */
export function take(s: GameState): GameState | null {
  return canTake(s) ? { ...s, status: 'won' } : null;
}

/** Почему «Забрать» неактивна — для подписи кнопки и строки подсказки (§7). */
export function takeBlock(s: GameState): 'no_exit' | 'no_gold' | null {
  if (!s.exitFound) return 'no_exit';
  if (s.gold < s.level.stars[0]) return 'no_gold';
  return null;
}
