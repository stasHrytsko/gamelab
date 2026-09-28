import { SIZE, type GameState, type Level, type Move, type Piece, type Rule } from './types.ts';

// Правила §4–5 спеки. `fits`, `legal` и `place` — порт tools/tight-shelf-solver.mjs
// без изменений; tests/engine.test.ts сверяет их с солвером.

/** 24 линии по три клетки: 8 горизонтальных, 8 вертикальных, 8 диагональных. */
export const WINDOWS: readonly (readonly number[])[] = (() => {
  const out: number[][] = [];
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]] as const) {
        const cells = [0, 1, 2].map((i) => [r + dr * i, c + dc * i] as const);
        if (cells.every(([y, x]) => y >= 0 && y < SIZE && x >= 0 && x < SIZE)) out.push(cells.map(([y, x]) => y * SIZE + x));
      }
    }
  }
  return out;
})();
const WINDOWS_AT = Array.from({ length: SIZE * SIZE }, (_, i) => WINDOWS.filter((w) => w.includes(i)));

/** Фигура подходит клетке: правило `.`, её цвет или её форма (§3). */
export const fits = (rule: Rule, piece: Piece): boolean => rule === '.' || rule === piece[0] || rule === piece[1];

const share = (a: Piece, b: Piece, c: Piece): boolean => (a[0] === b[0] && a[0] === c[0]) || (a[1] === b[1] && a[1] === c[1]);

/** Пустые клетки, куда можно поставить фигуру. */
export function legal(rules: readonly Rule[], board: readonly (Piece | null)[], piece: Piece): number[] {
  const out: number[] = [];
  for (let i = 0; i < SIZE * SIZE; i += 1) if (board[i] === null && fits(rules[i] ?? '.', piece)) out.push(i);
  return out;
}

/** Поставить фигуру и убрать собранные линии через неё (§4, «Исчезновение линий»). */
export function place(board: readonly (Piece | null)[], cell: number, piece: Piece): { board: (Piece | null)[]; lines: number; cleared: number[]; lineCells: number[][] } {
  const b = board.slice();
  b[cell] = piece;
  const kill = new Set<number>();
  const lineCells: number[][] = [];
  for (const w of WINDOWS_AT[cell] ?? []) {
    const [x, y, z] = w.map((i) => b[i] ?? null);
    if (x === null || y === null || z === null || x === undefined || y === undefined || z === undefined) continue;
    if (share(x, y, z)) {
      lineCells.push([...w]);
      w.forEach((i) => kill.add(i));
    }
  }
  kill.forEach((i) => (b[i] = null));
  return { board: b, lines: lineCells.length, cleared: [...kill], lineCells };
}

export function parseRules(level: Level): Rule[] {
  return level.rules.join('').split('') as Rule[];
}

export function createState(level: Level): GameState {
  return {
    level: level.id,
    rules: parseRules(level),
    board: new Array<Piece | null>(SIZE * SIZE).fill(null),
    queue: level.queue,
    turn: 0,
    status: 'playing',
    failReason: null,
  };
}

export const current = (state: GameState): Piece | null => state.queue[state.turn] ?? null;

/** Клетки, куда можно поставить текущую фигуру. */
export const legalNow = (state: GameState): number[] => {
  const piece = current(state);
  return piece === null ? [] : legal(state.rules, state.board, piece);
};

/**
 * Тап по клетке (§4). `null` — ход невозможен: клетка занята, правило не
 * подходит или попытка уже закончена. Порядок проверок — §5: поставить →
 * убрать линии → сдвинуть очередь → победа → `no_moves`.
 */
export function tapCell(state: GameState, cell: number): { state: GameState; move: Move } | null {
  if (state.status !== 'playing') return null;
  const piece = current(state);
  if (piece === null || !legal(state.rules, state.board, piece).includes(cell)) return null;
  const result = place(state.board, cell, piece);
  const turn = state.turn + 1;
  let next: GameState = { ...state, board: result.board, turn };
  if (turn >= state.queue.length) next = { ...next, status: 'won' };
  else if (legalNow(next).length === 0) next = { ...next, status: 'failed', failReason: 'no_moves' };
  return { state: next, move: { cell, piece, lines: result.lines, cleared: result.cleared, lineCells: result.lineCells } };
}
