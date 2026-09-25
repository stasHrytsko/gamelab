import { BUILDER, type Board, type Cell, type GameState, type Level, type Point } from './types.ts';

const STEPS: readonly Point[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const key = (r: number, c: number): string => `${String(r)},${String(c)}`;

export function parseMap(map: readonly string[]): Cell[][] {
  return map.map((row) => [...row].map((ch) => (ch === '.' ? null : 'wall')));
}

export function createState(level: Level): GameState {
  return {
    level: level.id,
    board: parseMap(level.map),
    numbers: level.numbers,
    used: level.numbers.map(() => false),
    status: 'playing',
  };
}

export const emptyCount = (board: Board): number => board.flat().filter((cell) => cell === null).length;

/** Клетки касаются сторонами и образуют один кусок. */
export function isConnected(cells: readonly Point[]): boolean {
  if (cells.length === 0) return false;
  const set = new Set(cells.map(([r, c]) => key(r, c)));
  const first = cells[0] as Point;
  const seen = new Set([key(first[0], first[1])]);
  const stack: Point[] = [first];
  while (stack.length > 0) {
    const [r, c] = stack.pop() as Point;
    for (const [dr, dc] of STEPS) {
      const k = key(r + dr, c + dc);
      if (set.has(k) && !seen.has(k)) {
        seen.add(k);
        stack.push([r + dr, c + dc]);
      }
    }
  }
  return seen.size === set.size;
}

/** Сдвигает фигуру в левый верхний угол: так её клетки хранятся и ставятся. */
export function normalize(cells: readonly Point[]): Point[] {
  const r0 = Math.min(...cells.map((p) => p[0]));
  const c0 = Math.min(...cells.map((p) => p[1]));
  return cells.map(([r, c]) => [r - r0, c - c0] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

export const fitsBuilder = (cells: readonly Point[]): boolean => {
  const n = normalize(cells);
  return n.every(([r, c]) => r < BUILDER && c < BUILDER);
};

/** §4: фигура готова, когда отмечено ровно N клеток и они связны. */
export const isPieceReady = (cells: readonly Point[], size: number): boolean =>
  cells.length === size && isConnected(cells);

/** Клетки поля, которые займёт фигура, если её левый верхний угол встанет в (row, col). */
export const shift = (shape: readonly Point[], row: number, col: number): Point[] =>
  shape.map(([r, c]) => [r + row, c + col] as const);

export function canPlace(board: Board, cells: readonly Point[]): boolean {
  return cells.every(([r, c]) => board[r]?.[c] === null);
}

export type PlaceOutcome =
  | { readonly valid: false; readonly state: GameState }
  | { readonly valid: true; readonly state: GameState };

/** §5: уложить фигуру числа index в клетки поля; затем победа или проверка решаемости. */
export function place(state: GameState, index: number, cells: readonly Point[]): PlaceOutcome {
  const size = state.numbers[index];
  if (state.status !== 'playing' || size === undefined || state.used[index] === true) return { valid: false, state };
  if (!isPieceReady(cells, size) || !fitsBuilder(cells) || !canPlace(state.board, cells)) return { valid: false, state };
  const board = state.board.map((row) => [...row]);
  for (const [r, c] of cells) (board[r] as Cell[])[c] = size;
  const used = state.used.map((u, i) => u || i === index);
  const left = state.numbers.filter((_, i) => !used[i]);
  const status = left.length === 0 ? 'won' : solve(board, left) === null ? 'failed' : 'playing';
  return { valid: true, state: { ...state, board, used, status } };
}

// ---------- солвер (§5, §6) ----------

interface Grid {
  readonly h: number;
  readonly w: number;
  readonly free: Uint8Array;
}

function toGrid(board: Board): Grid {
  const h = board.length;
  const w = board[0]?.length ?? 0;
  const free = new Uint8Array(h * w);
  board.forEach((row, r) => row.forEach((cell, c) => { free[r * w + c] = cell === null ? 1 : 0; }));
  return { h, w, free };
}

function neighbours(g: Grid, i: number): number[] {
  const r = Math.floor(i / g.w);
  const c = i % g.w;
  const out: number[] = [];
  if (r > 0) out.push(i - g.w);
  if (r < g.h - 1) out.push(i + g.w);
  if (c > 0) out.push(i - 1);
  if (c < g.w - 1) out.push(i + 1);
  return out;
}

/** Каждый свободный кусок поля должен закрываться какой-то частью оставшихся чисел. */
function regionsFit(g: Grid, sizes: readonly number[]): boolean {
  if (sizes.length === 0) return !g.free.includes(1);
  let sums = 1n;
  for (const v of sizes) sums |= sums << BigInt(v);
  const seen = new Uint8Array(g.free.length);
  const min = Math.min(...sizes);
  for (let i = 0; i < g.free.length; i += 1) {
    if (g.free[i] !== 1 || seen[i] === 1) continue;
    let n = 0;
    const stack = [i];
    seen[i] = 1;
    while (stack.length > 0) {
      const x = stack.pop() as number;
      n += 1;
      for (const y of neighbours(g, x)) {
        if (g.free[y] === 1 && seen[y] !== 1) {
          seen[y] = 1;
          stack.push(y);
        }
      }
    }
    if (n < min || ((sums >> BigInt(n)) & 1n) === 0n) return false;
  }
  return true;
}

/** Все связные наборы из k свободных клеток с корнем root (остальные клетки — после root), в рамке 4×4. */
function piecesAt(g: Grid, root: number, k: number): number[][] {
  const out: number[][] = [];
  const excluded = new Uint8Array(g.free.length);
  const inBox = (cells: number[]): boolean => {
    const rows = cells.map((i) => Math.floor(i / g.w));
    const cols = cells.map((i) => i % g.w);
    return Math.max(...rows) - Math.min(...rows) < BUILDER && Math.max(...cols) - Math.min(...cols) < BUILDER;
  };
  const grow = (cur: number[], untried: number[]): void => {
    if (cur.length === k) {
      if (inBox(cur)) out.push([...cur]);
      return;
    }
    if (!inBox(cur)) return;
    const pool = [...untried];
    const marked: number[] = [];
    while (pool.length > 0) {
      const x = pool.pop() as number;
      const fresh = neighbours(g, x).filter((y) => y > root && g.free[y] === 1 && excluded[y] !== 1);
      for (const y of fresh) excluded[y] = 1;
      cur.push(x);
      grow(cur, [...pool, ...fresh]);
      cur.pop();
      for (const y of fresh) excluded[y] = 0;
      marked.push(x);
    }
  };
  excluded[root] = 1;
  const start = neighbours(g, root).filter((y) => y > root && g.free[y] === 1);
  for (const y of start) excluded[y] = 1;
  grow([root], start);
  return out;
}

/**
 * Раскладывает свободные клетки на связные фигуры заданных размеров (каждая в рамке 4×4).
 * Возвращает фигуры решения или null. onSolution — для подсчёта всех решений.
 */
function search(g: Grid, sizes: number[], acc: number[][], onSolution: (pieces: number[][]) => boolean): boolean {
  const root = g.free.indexOf(1);
  if (root === -1) return sizes.length === 0 && onSolution(acc);
  for (const k of [...new Set(sizes)].sort((a, b) => b - a)) {
    const rest = [...sizes];
    rest.splice(rest.indexOf(k), 1);
    for (const piece of piecesAt(g, root, k)) {
      for (const i of piece) g.free[i] = 0;
      acc.push(piece);
      const stop = regionsFit(g, rest) && search(g, rest, acc, onSolution);
      acc.pop();
      for (const i of piece) g.free[i] = 1;
      if (stop) return true;
    }
  }
  return false;
}

export function solve(board: Board, sizes: readonly number[]): Point[][] | null {
  const g = toGrid(board);
  if (!regionsFit(g, sizes)) return null;
  let found: number[][] | null = null;
  search(g, [...sizes], [], (pieces) => {
    found = pieces.map((p) => [...p]);
    return true;
  });
  const result: number[][] | null = found;
  if (result === null) return null;
  return (result as number[][]).map((piece) => piece.map((i) => [Math.floor(i / g.w), i % g.w] as const));
}

export function countSolutions(board: Board, sizes: readonly number[], cap: number): number {
  const g = toGrid(board);
  if (!regionsFit(g, sizes)) return 0;
  let n = 0;
  search(g, [...sizes], [], () => {
    n += 1;
    return n >= cap;
  });
  return n;
}

/**
 * «Змейка» (§6, kill-тест): поле обходится рядами слева направо и справа налево,
 * фигуры — подряд идущие куски этого обхода, числа в любом порядке.
 */
export function snakeSolves(board: Board, sizes: readonly number[]): boolean {
  const order: Point[] = [];
  board.forEach((row, r) => {
    const cols = row.map((_, c) => c);
    for (const c of r % 2 === 0 ? cols : cols.reverse()) if (row[c] === null) order.push([r, c]);
  });
  const values = [...new Set(sizes)];
  const memo = new Map<string, boolean>();
  const go = (pos: number, counts: number[]): boolean => {
    if (pos === order.length) return true;
    const id = `${String(pos)}:${counts.join(',')}`;
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    let ok = false;
    for (let j = 0; j < values.length && !ok; j += 1) {
      const k = values[j] as number;
      if ((counts[j] ?? 0) === 0) continue;
      const chunk = order.slice(pos, pos + k);
      if (chunk.length === k && isConnected(chunk) && fitsBuilder(chunk)) {
        counts[j] = (counts[j] ?? 0) - 1;
        ok = go(pos + k, counts);
        counts[j] = (counts[j] ?? 0) + 1;
      }
    }
    memo.set(id, ok);
    return ok;
  };
  return go(0, values.map((v) => sizes.filter((s) => s === v).length));
}

/** Кусок поля, который не закрыть оставшимися числами, — для подсветки при поражении. */
export function deadRegion(board: Board, sizes: readonly number[]): Point[] {
  const g = toGrid(board);
  const seen = new Uint8Array(g.free.length);
  const regions: number[][] = [];
  for (let i = 0; i < g.free.length; i += 1) {
    if (g.free[i] !== 1 || seen[i] === 1) continue;
    const cells: number[] = [];
    const stack = [i];
    seen[i] = 1;
    while (stack.length > 0) {
      const x = stack.pop() as number;
      cells.push(x);
      for (const y of neighbours(g, x)) {
        if (g.free[y] === 1 && seen[y] !== 1) {
          seen[y] = 1;
          stack.push(y);
        }
      }
    }
    regions.push(cells);
  }
  let sums = 1n;
  for (const v of sizes) sums |= sums << BigInt(v);
  const bad = regions.find((cells) => ((sums >> BigInt(cells.length)) & 1n) === 0n) ?? regions.sort((a, b) => a.length - b.length)[0] ?? [];
  return bad.map((i) => [Math.floor(i / g.w), i % g.w] as const);
}
