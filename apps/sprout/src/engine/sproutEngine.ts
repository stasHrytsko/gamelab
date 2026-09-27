import type { Cell, FailReason, GameState, Kind, Level } from './types.ts';
import { SIZE } from './types.ts';

// Правила шага — порт `step` из tools/sprout-solver.mjs без изменений
// (§4–5). tests/levels.test.ts прогоняет пути солвера через этот движок.

export const same = (a: Cell, b: Cell): boolean => a.row === b.row && a.col === b.col;

export function kindAt(level: Level, cell: Cell): Kind {
  const ch = level.rows[cell.row]?.[cell.col] ?? '#';
  if (ch === '#') return 'stone';
  if (ch === 'A') return 'start';
  if (ch === 'B') return 'goal';
  if (/[1-9]/.test(ch)) return 'water';
  return 'soil';
}

/** `+X` воды в клетке, 0 для всех остальных. */
export function bonusAt(level: Level, cell: Cell): number {
  const ch = level.rows[cell.row]?.[cell.col] ?? '.';
  return /[1-9]/.test(ch) ? Number(ch) : 0;
}

export function find(level: Level, ch: 'A' | 'B'): Cell {
  for (let row = 0; row < SIZE; row += 1) {
    const col = level.rows[row]?.indexOf(ch) ?? -1;
    if (col >= 0) return { row, col };
  }
  throw new Error(`${level.name}: no ${ch}`);
}

export function waterCells(level: Level): Cell[] {
  const out: Cell[] = [];
  for (let row = 0; row < SIZE; row += 1) for (let col = 0; col < SIZE; col += 1) if (bonusAt(level, { row, col }) > 0) out.push({ row, col });
  return out;
}

/** Соседи по стороне (вверх, вправо, вниз, влево — порядок как в солвере). */
export function neighbours(cell: Cell): Cell[] {
  return [
    { row: cell.row - 1, col: cell.col },
    { row: cell.row, col: cell.col + 1 },
    { row: cell.row + 1, col: cell.col },
    { row: cell.row, col: cell.col - 1 },
  ].filter((c) => c.row >= 0 && c.row < SIZE && c.col >= 0 && c.col < SIZE);
}

export const tipOf = (state: GameState): Cell => state.path[state.path.length - 1] as Cell;

export const onRoot = (state: GameState, cell: Cell): boolean => state.path.some((p) => same(p, cell));

/** Соседние клетки кончика, куда можно расти: не камень и не корень. */
export function freeNeighbours(level: Level, state: GameState): Cell[] {
  return neighbours(tipOf(state)).filter((c) => kindAt(level, c) !== 'stone' && !onRoot(state, c));
}

export function createState(level: Level): GameState {
  return { level: level.id, path: [find(level, 'A')], moves: level.start, status: 'playing', failReason: null };
}

/** Почему тап не стал шагом (§4) — для отклика на экране. */
export type Rejection = 'not_adjacent' | 'stone' | 'root' | 'not_playing';

export function reject(level: Level, state: GameState, cell: Cell): Rejection | null {
  if (state.status !== 'playing' || state.moves < 1) return 'not_playing';
  if (!neighbours(tipOf(state)).some((c) => same(c, cell))) return 'not_adjacent';
  if (kindAt(level, cell) === 'stone') return 'stone';
  if (onRoot(state, cell)) return 'root';
  return null;
}

export interface StepResult {
  readonly state: GameState;
  /** Выпитая этим шагом вода, 0 если нет. */
  readonly bonus: number;
}

/**
 * Один шаг (§4 п.1–7, порядок §5): рост → −1 → Б (победа) → +X →
 * запас 0 (`moves_exhausted`) → тупик (`no_moves`). `null` — шаг невозможен.
 */
export function step(level: Level, state: GameState, cell: Cell): StepResult | null {
  if (reject(level, state, cell) !== null) return null;
  const path = [...state.path, { row: cell.row, col: cell.col }];
  let moves = state.moves - 1;
  if (kindAt(level, cell) === 'goal') return { state: { ...state, path, moves, status: 'won', failReason: null }, bonus: 0 };
  const bonus = bonusAt(level, cell);
  moves += bonus;
  const next: GameState = { ...state, path, moves, status: 'playing', failReason: null };
  let failReason: FailReason | null = null;
  if (moves === 0) failReason = 'moves_exhausted';
  else if (freeNeighbours(level, next).length === 0) failReason = 'no_moves';
  return { state: failReason === null ? next : { ...next, status: 'failed', failReason }, bonus };
}

/** Кратчайшее расстояние от кончика до ближайшей невыпитой воды по свободным клеткам (для лога §8). */
export function nearestWaterDistance(level: Level, state: GameState): number | null {
  const start = tipOf(state);
  const seen = new Set([`${String(start.row)},${String(start.col)}`]);
  let frontier: Cell[] = [start];
  for (let d = 1; frontier.length > 0; d += 1) {
    const next: Cell[] = [];
    for (const cur of frontier) {
      for (const n of neighbours(cur)) {
        const key = `${String(n.row)},${String(n.col)}`;
        const kind = kindAt(level, n);
        if (seen.has(key) || kind === 'stone' || onRoot(state, n)) continue;
        seen.add(key);
        if (kind === 'water') return d;
        if (kind !== 'goal') next.push(n);
      }
    }
    frontier = next;
  }
  return null;
}
