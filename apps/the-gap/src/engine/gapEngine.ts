// Правила The Gap — specs/40-the-gap.md §4–5. Чистые функции без DOM.
// Правила хода — порт `moves` из tools/the-gap-solver.mjs; тест
// tests/parity.test.ts сверяет оба на случайных партиях.
import type { Action, Cell, Color, Dir, FailReason, GameState, Level, Move, Outcome } from './types.ts';

export const DIRS: readonly Dir[] = ['right', 'left', 'down', 'up'];
export const DELTA: Record<Dir, readonly [number, number]> = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] };

export function createState(level: Level): GameState {
  return {
    field: [...level.field],
    flasks: level.flasks.map((f) => [...f]),
    moves: 0,
    status: 'playing',
    failReason: null,
    stars: 0,
  };
}

const idx = (level: Level, x: number, y: number): number => y * level.w + x;

/** Победа (§5): поле пусто, каждая непустая колба одноцветна, цвет только в одной колбе. */
export function isWon(field: readonly Cell[], flasks: readonly (readonly Color[])[]): boolean {
  if (field.some((c) => c > 0)) return false;
  const seen = new Set<Color>();
  for (const flask of flasks) {
    const first = flask[0];
    if (first === undefined) continue;
    if (flask.some((c) => c !== first)) return false;
    if (seen.has(first)) return false;
    seen.add(first);
  }
  return true;
}

export interface Planned {
  readonly field: Cell[];
  readonly flasks: Color[][];
  readonly move: Move;
}

/** Свайп по квадрату на (x, y) — правила 1–6 из §4. `null`, если ход недопустим. */
export function planSwipe(level: Level, state: Pick<GameState, 'field' | 'flasks'>, x0: number, y0: number, dir: Dir): Planned | null {
  const cell = state.field[idx(level, x0, y0)];
  if (cell === undefined || cell <= 0) return null;
  const color = cell as Color;
  const [dx, dy] = DELTA[dir];
  let x = x0;
  let y = y0;
  for (;;) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= level.w || ny >= level.h) break;
    if (state.field[idx(level, nx, ny)] !== 0) break;
    x = nx;
    y = ny;
  }
  const steps = Math.abs(x - x0) + Math.abs(y - y0);
  const exitIndex = level.exits.findIndex((e) => e.x === x && e.y === y && e.dx === dx && e.dy === dy);
  const field = [...state.field];
  field[idx(level, x0, y0)] = 0;
  const flasks = state.flasks.map((f) => [...f]);
  if (exitIndex >= 0) {
    const flask = flasks[exitIndex];
    const cap = level.caps[exitIndex];
    if (flask !== undefined && cap !== undefined && flask.length < cap) {
      flask.push(color);
      return { field, flasks, move: { kind: 'in', color, from: { x: x0, y: y0 }, to: { x, y }, steps, flask: exitIndex + 1 } };
    }
  }
  if (steps === 0) return null;
  field[idx(level, x, y)] = color;
  return { field, flasks, move: { kind: 'slide', color, from: { x: x0, y: y0 }, to: { x, y }, steps, flask: null } };
}

/** Тап по колбе n (1..4) — правила 7–9 из §4. */
export function planReturn(level: Level, state: Pick<GameState, 'field' | 'flasks'>, n: number): Planned | null {
  const exit = level.exits[n - 1];
  const stack = state.flasks[n - 1];
  if (exit === undefined || stack === undefined || stack.length === 0) return null;
  if (state.field[idx(level, exit.x, exit.y)] !== 0) return null;
  const flasks = state.flasks.map((f) => [...f]);
  const color = flasks[n - 1]?.pop();
  if (color === undefined) return null;
  const field = [...state.field];
  field[idx(level, exit.x, exit.y)] = color;
  const at = { x: exit.x, y: exit.y };
  return { field, flasks, move: { kind: 'return', color, from: at, to: at, steps: 0, flask: n } };
}

/** Есть ли хоть один допустимый ход (для `no_moves`). */
export function hasAnyMove(level: Level, state: Pick<GameState, 'field' | 'flasks'>): boolean {
  for (let y = 0; y < level.h; y += 1) {
    for (let x = 0; x < level.w; x += 1) {
      if ((state.field[idx(level, x, y)] ?? 0) <= 0) continue;
      for (const dir of DIRS) if (planSwipe(level, state, x, y, dir) !== null) return true;
    }
  }
  for (let n = 1; n <= level.exits.length; n += 1) if (planReturn(level, state, n) !== null) return true;
  return false;
}

/** Звёзды (§5): три — не больше opt + 2, две — не больше ceil(1.5 × opt), одна — победа в лимит. */
export function starsFor(level: Level, moves: number): 1 | 2 | 3 {
  if (moves <= level.stars3) return 3;
  if (moves <= level.stars2) return 2;
  return 1;
}

function finish(level: Level, planned: Planned, prev: GameState): Outcome {
  const moves = prev.moves + 1;
  let status: GameState['status'] = 'playing';
  let failReason: FailReason | null = null;
  let stars: GameState['stars'] = 0;
  // Порядок проверок §5: победа → лимит ходов → нет ходов.
  if (isWon(planned.field, planned.flasks)) {
    status = 'won';
    stars = moves <= level.limit ? starsFor(level, moves) : 1;
  } else if (moves >= level.limit) {
    status = 'failed';
    failReason = 'moves_exhausted';
  } else if (!hasAnyMove(level, planned)) {
    status = 'failed';
    failReason = 'no_moves';
  }
  return { state: { field: planned.field, flasks: planned.flasks, moves, status, failReason, stars }, move: planned.move };
}

/** Свайп по квадрату. `null` — недопустимый ход, ход не тратится. */
export function swipe(level: Level, state: GameState, x: number, y: number, dir: Dir): Outcome | null {
  if (state.status !== 'playing') return null;
  const planned = planSwipe(level, state, x, y, dir);
  return planned === null ? null : finish(level, planned, state);
}

/** Тап по колбе n (1..4). `null` — недопустимый ход. */
export function tapFlask(level: Level, state: GameState, n: number): Outcome | null {
  if (state.status !== 'playing') return null;
  const planned = planReturn(level, state, n);
  return planned === null ? null : finish(level, planned, state);
}

export function apply(level: Level, state: GameState, action: Action): Outcome | null {
  return action.type === 'swipe' ? swipe(level, state, action.x, action.y, action.dir) : tapFlask(level, state, action.n);
}

/** Направление свайпа по смещению в пикселях; `null`, если смещение меньше порога (§4). */
export function swipeDir(dx: number, dy: number, threshold = 24): Dir | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

export interface ColorProgress {
  readonly color: Color;
  /** Сколько квадратов цвета лежит в одной одноцветной колбе. */
  readonly have: number;
  readonly total: number;
  readonly done: boolean;
}

/** Прогресс по цветам для счётчиков над полем (§7): цвет собран, когда все его квадраты в одной одноцветной колбе. */
export function colorProgress(level: Level, state: Pick<GameState, 'field' | 'flasks'>): ColorProgress[] {
  const total = new Map<Color, number>();
  const bump = (c: number): void => {
    if (c > 0) total.set(c as Color, (total.get(c as Color) ?? 0) + 1);
  };
  level.field.forEach(bump);
  level.flasks.forEach((f) => f.forEach(bump));
  const have = new Map<Color, number>();
  for (const flask of state.flasks) {
    const first = flask[0];
    if (first !== undefined && flask.every((c) => c === first)) have.set(first, Math.max(have.get(first) ?? 0, flask.length));
  }
  return [...total.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([color, n]) => ({ color, have: have.get(color) ?? 0, total: n, done: (have.get(color) ?? 0) === n }));
}
