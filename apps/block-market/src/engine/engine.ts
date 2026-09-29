// Чистые функции правил: без DOM и без случайности вне зерна. Каждое действие
// возвращает { state, event } или null, если оно недопустимо (ход не тратится).
import {
  baseCells, cellsKey, colorOf, dealtForms, mirror, normalize, rotate, STONE, swapPrice, TYPES, weightOf,
  type Cells, type PieceType,
} from './catalog.ts';
import { CFG, incomeFor } from './config.ts';
import type { LevelDef } from '../levels/levels.ts';
import { hash, makeRng, nextFloat, type Rng } from './rng.ts';

export interface Piece {
  readonly type: PieceType;
  readonly cells: Cells;
  readonly color: number;
}

export type Status = 'playing' | 'won' | 'lost';
/** Стабильные коды причин поражения (для лога). */
export type LoseReason = 'goal_missed';

export interface GameState {
  readonly seed: number;
  readonly def: LevelDef;
  readonly level: number;
  readonly goal: number;
  /** 64 клетки, ряд за рядом: 0 пусто, 1–5 цвет фигуры, 9 камень. */
  readonly board: readonly number[];
  /** Фигуры на руках (до трёх): любую можно ставить сразу. Что выйдет дальше, не показывается. */
  readonly hand: readonly Piece[];
  /** Сыграно или сгорело на этом уровне. */
  readonly used: number;
  readonly lines: number;
  readonly coins: number;
  readonly status: Status;
  readonly dealRng: Rng;
  /** Сколько фигур уже сдано на этом уровне (не больше PIECES). */
  readonly dealIdx: number;
  /** Монет, сгоревших о потолок кошелька, на этом уровне. */
  readonly capLost: number;
}

export type Purchase = 'rotate' | 'mirror' | 'swap';

export type GameEvent =
  | {
      kind: 'place';
      slot: number;
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
  | { kind: 'buy'; slot: number; purchase: Purchase; cost: number; burned: readonly Piece[] };

export interface Outcome {
  readonly state: GameState;
  readonly event: GameEvent;
}

const N = CFG.SIZE;
export const CELLS = N * N;
/** Самое дешёвое платное действие: с меньшим кошельком фигура, что не встала, сгорает. */
export const MIN_COST = Math.min(CFG.ROTATE_COST, CFG.MIRROR_COST, Math.min(...TYPES.map(swapPrice)));

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
export function preview(state: GameState, slot: number, x: number, y: number): (Placement & { lines: number; income: number }) | null {
  const piece = state.hand[slot];
  if (state.status !== 'playing' || piece === undefined || !fits(state.board, piece.cells, x, y)) return null;
  const placement = applyPlacement(state.board, piece.cells, piece.color, x, y);
  const lines = placement.rows.length + placement.cols.length;
  return { ...placement, lines, income: incomeFor(lines) };
}

// ---------- сдача ----------
function drawType(mix: number, rng: Rng): PieceType {
  const weights = TYPES.map((t) => weightOf(t, mix));
  const total = weights.reduce((a, b) => a + b, 0);
  const u = nextFloat(rng);
  let acc = 0;
  for (let i = 0; i < TYPES.length; i += 1) {
    acc += (weights[i] ?? 0) / total;
    if (u <= acc) return TYPES[i] as PieceType;
  }
  return TYPES[TYPES.length - 1] as PieceType;
}

/**
 * Сдаёт фигуру. С `hostile` из k кандидатов берётся та, что хуже всего ложится
 * на поле как есть; без него — просто случайная. `mix` — глубина набора фигур.
 * `avoid` — типы, которые уже на руке: они не выпадают (если только не повезло 8 раз подряд).
 */
export function deal(mix: number, k: number, board: readonly number[], rng: Rng, hostile: boolean, avoid: readonly PieceType[] = []): Piece {
  const n = hostile ? k : 1;
  let pick: Piece | null = null;
  let pickFits = Infinity;
  for (let i = 0; i < n; i += 1) {
    let type = drawType(mix, rng);
    // не даём две одинаковые фигуры на одной руке (на пустом поле неудобнее всех палка, и без этого их было бы три)
    for (let tries = 0; tries < 8 && avoid.includes(type); tries += 1) type = drawType(mix, rng);
    const forms = dealtForms(type);
    const cells = forms[Math.floor(nextFloat(rng) * forms.length)] as Cells;
    const fitsCount = countFits(board, cells);
    if (fitsCount < pickFits) {
      pickFits = fitsCount;
      pick = { type, cells, color: colorOf(type) };
    }
  }
  return pick as Piece;
}

// ---------- уровень ----------
type Draft = { -readonly [K in keyof GameState]: GameState[K] } & { board: number[]; hand: Piece[] };

const draft = (s: GameState): Draft => ({ ...s, board: s.board.slice(), hand: s.hand.slice(), dealRng: { ...s.dealRng } });

function dealNext(d: Draft): Piece {
  const hostile = d.dealIdx % CFG.HOSTILE_EVERY === 0;
  d.dealIdx += 1;
  return deal(d.def.mix, d.def.hostileK, d.board, d.dealRng, hostile, d.hand.map((p) => p.type));
}

export interface LevelOptions {
  /** Своё зерно вместо зерна уровня (?seed=N). */
  readonly seed?: number | null;
  /** Своя цель по линиям вместо цели уровня (?goal=N). */
  readonly goal?: number | null;
}

export function startLevel(def: LevelDef, options: LevelOptions = {}): GameState {
  const seed = options.seed ?? def.seed;
  const board = new Array<number>(CELLS).fill(0);
  const stoneRng = makeRng(hash(seed, def.id, 1));
  for (let n = 0; n < def.stones; ) {
    const y = Math.floor(nextFloat(stoneRng) * N), x = Math.floor(nextFloat(stoneRng) * N);
    if (board[y * N + x] === 0) { board[y * N + x] = STONE; n += 1; }
  }
  for (let y = 0; y < N; y += 1) if (board.slice(y * N, y * N + N).every((v) => v !== 0)) board.fill(0, y * N, y * N + N);
  const d: Draft = {
    seed, def, level: def.id, goal: options.goal ?? def.goal, board, hand: [], used: 0, lines: 0, coins: CFG.START_COINS,
    status: 'playing', dealRng: makeRng(hash(seed, def.id, 2)), dealIdx: 0, capLost: 0,
  };
  for (let i = 0; i < 3; i += 1) d.hand.push(dealNext(d));
  settle(d, []);
  return d;
}

/** Фигура ушла с руки (поставлена или сгорела): на её место встаёт новая, пока сданы не все 20. */
function useSlot(d: Draft, slot: number): void {
  d.used += 1;
  if (d.dealIdx < CFG.PIECES) d.hand[slot] = dealNext(d);
  else d.hand.splice(slot, 1);
}

/**
 * Можно ли за имеющиеся монеты сделать так, чтобы какая-то фигура встала:
 * повернуть (по часовой, каждый раз 2), отзеркалить, заменить на другую и потом повернуть.
 */
export function rescuable(board: readonly number[], hand: readonly Piece[], coins: number): boolean {
  const orientations = (cells: Cells, budget: number): boolean => {
    let base = cells;
    for (let m = 0; m < 2; m += 1) {
      const mirrorCost = m * CFG.MIRROR_COST;
      let c = base;
      for (let r = 0; r < 4; r += 1) {
        if (mirrorCost + r * CFG.ROTATE_COST <= budget && countFits(board, c) > 0) return true;
        c = rotate(c);
      }
      base = mirror(cells);
    }
    return false;
  };
  for (const piece of hand) {
    if (orientations(piece.cells, coins)) return true;
    for (const type of TYPES) {
      const price = swapPrice(type);
      if (price <= coins && orientations(baseCells(type), coins - price)) return true;
    }
  }
  return false;
}

/** Сжигает фигуру, когда ни одной некуда встать и никакая покупка не поможет; закрывает уровень после 20-й. */
function settle(d: Draft, burned: Piece[]): void {
  while (d.status === 'playing') {
    if (d.used >= CFG.PIECES) {
      d.status = d.lines >= d.goal ? 'won' : 'lost';
      return;
    }
    if (d.hand.every((p) => countFits(d.board, p.cells) === 0) && !rescuable(d.board, d.hand, d.coins)) {
      burned.push(d.hand[0] as Piece);
      useSlot(d, 0);
      continue;
    }
    return;
  }
}

// ---------- действия ----------
export function place(state: GameState, slot: number, x: number, y: number): Outcome | null {
  const current = state.hand[slot];
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
  useSlot(d, slot);
  const burned: Piece[] = [];
  settle(d, burned);
  return {
    state: d,
    event: { kind: 'place', slot, cleared: placement.cleared, rows: placement.rows, cols: placement.cols, lines, income, gained, burned, placed: placement.placed },
  };
}

function buy(state: GameState, slot: number, cost: number, purchase: Purchase, replacement: (d: Draft, piece: Piece) => Piece | null): Outcome | null {
  if (state.status !== 'playing' || state.coins < cost || state.hand[slot] === undefined) return null;
  const d = draft(state);
  const next = replacement(d, d.hand[slot] as Piece);
  if (next === null) return null;
  d.coins -= cost;
  d.hand[slot] = next;
  const burned: Piece[] = [];
  settle(d, burned);
  return { state: d, event: { kind: 'buy', slot, purchase, cost, burned } };
}

/** Поворот фигуры на руке на 90° по часовой стрелке; у симметричной, где ничего не меняется, — недопустим. */
export function rotatePiece(state: GameState, slot: number): Outcome | null {
  return buy(state, slot, CFG.ROTATE_COST, 'rotate', (_d, p) => {
    const cells = rotate(p.cells);
    return cellsKey(cells) === cellsKey(normalize(p.cells)) ? null : { ...p, cells };
  });
}

export function mirrorPiece(state: GameState, slot: number): Outcome | null {
  return buy(state, slot, CFG.MIRROR_COST, 'mirror', (_d, p) => {
    const cells = mirror(p.cells);
    return cellsKey(cells) === cellsKey(normalize(p.cells)) ? null : { ...p, cells };
  });
}

export function swapPiece(state: GameState, slot: number, type: PieceType): Outcome | null {
  return buy(state, slot, swapPrice(type), 'swap', (_d, p) => {
    const cells = baseCells(type);
    if (p.type === type && cellsKey(cells) === cellsKey(normalize(p.cells))) return null;
    return { type, cells, color: colorOf(type) };
  });
}

/** Ни одной из фигур на руках некуда встать (для подсказки игроку). */
export const stuck = (state: GameState): boolean =>
  state.hand.length > 0 && state.hand.every((p) => countFits(state.board, p.cells) === 0);
