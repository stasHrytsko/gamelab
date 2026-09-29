// Чистые функции правил: без DOM и без случайности вне зерна. Каждое действие
// возвращает { state, event } или null, если оно недопустимо (ход не тратится).
import {
  baseCells, cellsKey, colorOf, dealtForms, mirror, normalize, rotate, STONE, swapPrice, TYPES, weightOf,
  type Cells, type PieceType,
} from './catalog.ts';
import { blockersFor, CFG, goalFor, hostileK, incomeFor } from './config.ts';
import { hash, makeRng, nextFloat, type Rng } from './rng.ts';

export interface Piece {
  readonly type: PieceType;
  readonly cells: Cells;
  readonly color: number;
}

export type Status = 'playing' | 'level_won' | 'lost' | 'run_won';
/** Стабильные коды причин поражения (для лога). */
export type LoseReason = 'goal_missed';

export interface GameState {
  readonly seed: number;
  readonly level: number;
  readonly goal: number;
  /** ?goal=N в адресе: одна цель на все уровни, для проверки. */
  readonly goalOverride: number | null;
  /** 64 клетки, ряд за рядом: 0 пусто, 1–5 цвет фигуры, 9 камень. */
  readonly board: readonly number[];
  /** [текущая, следующая, через одну]. */
  readonly queue: readonly Piece[];
  /** Сыграно или сгорело на этом уровне. */
  readonly used: number;
  readonly lines: number;
  readonly coins: number;
  readonly status: Status;
  readonly dealRng: Rng;
  readonly rerollRng: Rng;
  readonly dealIdx: number;
  readonly levelsCleared: number;
  /** Монет, сгоревших о потолок кошелька, за весь забег. */
  readonly capLost: number;
}

export type Purchase = 'rotate' | 'mirror' | 'swap' | 'reroll';

export type GameEvent =
  | {
      kind: 'place';
      /** Индексы клеток, которые исчезли (в т.ч. только что поставленные). */
      cleared: readonly number[];
      rows: readonly number[];
      cols: readonly number[];
      lines: number;
      income: number;
      /** Сколько монет реально добавилось: income минус то, что не влезло в кошелёк. */
      gained: number;
      burned: readonly Piece[];
      placed: readonly number[];
    }
  | { kind: 'buy'; purchase: Purchase; cost: number; burned: readonly Piece[] };

export interface Outcome {
  readonly state: GameState;
  readonly event: GameEvent;
}

const N = CFG.SIZE;
export const CELLS = N * N;
/** Самое дешёвое платное действие: с меньшим кошельком фигура, что не встала, сгорает. */
export const MIN_COST = Math.min(CFG.ROTATE_COST, CFG.MIRROR_COST, CFG.REROLL_COST, Math.min(...TYPES.map(swapPrice)));

// ---------- поле ----------
export function fits(board: readonly number[], cells: Cells, x: number, y: number): boolean {
  for (const [r, c] of cells) {
    const yy = y + r, xx = x + c;
    if (yy < 0 || yy >= N || xx < 0 || xx >= N || board[yy * N + xx] !== 0) return false;
  }
  return true;
}

export function countFits(board: readonly number[], cells: Cells): number {
  let count = 0;
  const h = Math.max(...cells.map((c) => c[0])) + 1;
  const w = Math.max(...cells.map((c) => c[1])) + 1;
  for (let y = 0; y + h <= N; y += 1) for (let x = 0; x + w <= N; x += 1) if (fits(board, cells, x, y)) count += 1;
  return count;
}

export interface Placement {
  readonly board: readonly number[];
  readonly rows: readonly number[];
  readonly cols: readonly number[];
  readonly cleared: readonly number[];
  readonly placed: readonly number[];
}

/** Ставит фигуру и убирает полные строки и столбцы одновременно. Допустимость не проверяет. */
export function applyPlacement(board: readonly number[], cells: Cells, color: number, x: number, y: number): Placement {
  const next = board.slice();
  const placed = cells.map(([r, c]) => (y + r) * N + (x + c));
  for (const i of placed) next[i] = color;
  const rows: number[] = [], cols: number[] = [];
  for (let i = 0; i < N; i += 1) {
    if (Array.from({ length: N }, (_, c) => next[i * N + c]).every((v) => v !== 0)) rows.push(i);
    if (Array.from({ length: N }, (_, r) => next[r * N + i]).every((v) => v !== 0)) cols.push(i);
  }
  const cleared = new Set<number>();
  for (const r of rows) for (let c = 0; c < N; c += 1) cleared.add(r * N + c);
  for (const c of cols) for (let r = 0; r < N; r += 1) cleared.add(r * N + c);
  for (const i of cleared) next[i] = 0;
  return { board: next, rows, cols, cleared: [...cleared].sort((a, b) => a - b), placed };
}

/** Что будет, если поставить текущую фигуру в (x, y): для подсказки на поле. */
export function preview(state: GameState, x: number, y: number): (Placement & { lines: number; income: number }) | null {
  const piece = state.queue[0];
  if (state.status !== 'playing' || piece === undefined || !fits(state.board, piece.cells, x, y)) return null;
  const placement = applyPlacement(state.board, piece.cells, piece.color, x, y);
  const lines = placement.rows.length + placement.cols.length;
  return { ...placement, lines, income: incomeFor(lines) };
}

// ---------- сдача ----------
function drawType(level: number, rng: Rng): PieceType {
  const weights = TYPES.map((t) => weightOf(t, level));
  const total = weights.reduce((a, b) => a + b, 0);
  const u = nextFloat(rng);
  let acc = 0;
  for (let i = 0; i < TYPES.length; i += 1) {
    acc += (weights[i] ?? 0) / total;
    if (u <= acc) return TYPES[i] as PieceType;
  }
  return TYPES[TYPES.length - 1] as PieceType;
}

/** Из k кандидатов берётся та, что хуже всего ложится без платных действий; без hostile — просто случайная. */
export function deal(level: number, board: readonly number[], rng: Rng, hostile: boolean): Piece {
  const k = hostile ? hostileK(level) : 1;
  let pick: Piece | null = null;
  let pickFits = Infinity;
  for (let i = 0; i < k; i += 1) {
    const type = drawType(level, rng);
    const forms = dealtForms(type);
    const cells = forms[Math.floor(nextFloat(rng) * forms.length)] as Cells;
    const n = countFits(board, cells);
    if (n < pickFits) {
      pickFits = n;
      pick = { type, cells, color: colorOf(type) };
    }
  }
  return pick as Piece;
}

// ---------- уровень и забег ----------
type Draft = { -readonly [K in keyof GameState]: GameState[K] } & { board: number[]; queue: Piece[] };

const draft = (s: GameState): Draft => ({
  ...s, board: s.board.slice(), queue: s.queue.slice(), dealRng: { ...s.dealRng }, rerollRng: { ...s.rerollRng },
});

function dealNext(d: Draft): Piece {
  const hostile = d.dealIdx % CFG.HOSTILE_EVERY === 0;
  d.dealIdx += 1;
  return deal(d.level, d.board, d.dealRng, hostile);
}

function buildLevel(seed: number, level: number, coins: number, goalOverride: number | null, carry: { levelsCleared: number; capLost: number }): GameState {
  const board = new Array<number>(CELLS).fill(0);
  const blockerRng = makeRng(hash(seed, level, 1));
  for (let n = 0; n < blockersFor(level); ) {
    const y = Math.floor(nextFloat(blockerRng) * N), x = Math.floor(nextFloat(blockerRng) * N);
    if (board[y * N + x] === 0) { board[y * N + x] = STONE; n += 1; }
  }
  for (let y = 0; y < N; y += 1) if (board.slice(y * N, y * N + N).every((v) => v !== 0)) board.fill(0, y * N, y * N + N);
  const d: Draft = {
    seed, level, goal: goalOverride ?? goalFor(level), goalOverride, board, queue: [], used: 0, lines: 0, coins,
    status: 'playing', dealRng: makeRng(hash(seed, level, 2)), rerollRng: makeRng(hash(seed, level, 3)), dealIdx: 0,
    levelsCleared: carry.levelsCleared, capLost: carry.capLost,
  };
  d.queue = [dealNext(d), dealNext(d), dealNext(d)];
  settle(d, []);
  return d;
}

export interface RunOptions {
  readonly level?: number;
  readonly goal?: number | null;
}

export function startRun(seed: number, options: RunOptions = {}): GameState {
  return buildLevel(seed, options.level ?? 1, CFG.START_COINS, options.goal ?? null, { levelsCleared: 0, capLost: 0 });
}

/** Следующий уровень после `level_won`: кошелёк переносится. */
export function nextLevel(state: GameState): GameState | null {
  if (state.status !== 'level_won') return null;
  return buildLevel(state.seed, state.level + 1, state.coins, state.goalOverride, state);
}

/** Сжигает фигуры, которым некуда встать и нечем платить; закрывает уровень после 20-й. */
function settle(d: Draft, burned: Piece[]): void {
  while (d.status === 'playing') {
    if (d.used >= CFG.PIECES) {
      if (d.lines >= d.goal) {
        d.levelsCleared += 1;
        const room = CFG.CAP - d.coins;
        d.capLost += Math.max(0, CFG.LEVEL_BONUS - room);
        d.coins = Math.min(CFG.CAP, d.coins + CFG.LEVEL_BONUS);
        d.status = d.level >= CFG.MAX_LEVELS ? 'run_won' : 'level_won';
      } else d.status = 'lost';
      return;
    }
    const current = d.queue[0] as Piece;
    if (countFits(d.board, current.cells) === 0 && d.coins < MIN_COST) {
      burned.push(current);
      d.used += 1;
      d.queue.shift();
      d.queue.push(dealNext(d));
      continue;
    }
    return;
  }
}

// ---------- действия ----------
export function place(state: GameState, x: number, y: number): Outcome | null {
  const current = state.queue[0];
  if (state.status !== 'playing' || current === undefined || !fits(state.board, current.cells, x, y)) return null;
  const d = draft(state);
  const placement = applyPlacement(d.board, current.cells, current.color, x, y);
  d.board = placement.board.slice();
  const lines = placement.rows.length + placement.cols.length;
  const income = incomeFor(lines);
  const before = d.coins;
  d.coins = Math.min(CFG.CAP, d.coins + income);
  const gained = d.coins - before;
  d.capLost += income - gained;
  d.lines += lines;
  d.used += 1;
  d.queue.shift();
  d.queue.push(dealNext(d));
  const burned: Piece[] = [];
  settle(d, burned);
  return {
    state: d,
    event: { kind: 'place', cleared: placement.cleared, rows: placement.rows, cols: placement.cols, lines, income, gained, burned, placed: placement.placed },
  };
}

function buy(state: GameState, cost: number, purchase: Purchase, replacement: (d: Draft) => Piece | null): Outcome | null {
  if (state.status !== 'playing' || state.coins < cost) return null;
  const d = draft(state);
  const next = replacement(d);
  if (next === null) return null;
  d.coins -= cost;
  d.queue[0] = next;
  const burned: Piece[] = [];
  settle(d, burned);
  return { state: d, event: { kind: 'buy', purchase, cost, burned } };
}

/** Поворот текущей фигуры на 90° по часовой стрелке; у симметричной, где ничего не меняется, — недопустим. */
export function rotateCurrent(state: GameState): Outcome | null {
  return buy(state, CFG.ROTATE_COST, 'rotate', (d) => {
    const p = d.queue[0] as Piece;
    const cells = rotate(p.cells);
    return cellsKey(cells) === cellsKey(normalize(p.cells)) ? null : { ...p, cells };
  });
}

export function mirrorCurrent(state: GameState): Outcome | null {
  return buy(state, CFG.MIRROR_COST, 'mirror', (d) => {
    const p = d.queue[0] as Piece;
    const cells = mirror(p.cells);
    return cellsKey(cells) === cellsKey(normalize(p.cells)) ? null : { ...p, cells };
  });
}

export function swapCurrent(state: GameState, type: PieceType): Outcome | null {
  return buy(state, swapPrice(type), 'swap', (d) => {
    const p = d.queue[0] as Piece;
    const cells = baseCells(type);
    if (p.type === type && cellsKey(cells) === cellsKey(normalize(p.cells))) return null;
    return { type, cells, color: colorOf(type) };
  });
}

/** Пересдача: новая случайная фигура, без «неудобности». */
export function rerollCurrent(state: GameState): Outcome | null {
  return buy(state, CFG.REROLL_COST, 'reroll', (d) => deal(d.level, d.board, d.rerollRng, false));
}

/** Нет ни одной постановки текущей фигуры как есть (для подсказки игроку). */
export const stuck = (state: GameState): boolean => {
  const current = state.queue[0];
  return current !== undefined && countFits(state.board, current.cells) === 0;
};
