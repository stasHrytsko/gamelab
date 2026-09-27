// Типы для импорта солвера из тестов apps/sprout (TypeScript strict).

export interface SolverLevel {
  readonly name: string;
  readonly start: number;
  readonly rows: readonly string[];
  readonly tutorial?: boolean;
}

export interface Grid {
  readonly size: number;
  readonly a: number;
  readonly b: number;
  readonly stone: readonly boolean[];
  readonly bonus: readonly number[];
  readonly water: readonly number[];
  readonly start: number;
}

export interface SolverState {
  readonly tip: number;
  readonly path: readonly number[];
  readonly moves: number;
  readonly status: 'playing' | 'won' | 'failed';
  readonly failReason: 'moves_exhausted' | 'no_moves' | 'no_route' | null;
}

export interface SolveResult {
  readonly solvable: boolean;
  /** Ключ — индексы воды через запятую в порядке выпивания, значение — кратчайший путь (индексы клеток от А до Б). */
  readonly orders: Map<string, number[]>;
  readonly nodes: number;
  readonly aborted: boolean;
}

export const GAME_LEVELS: readonly SolverLevel[];
export function parse(level: SolverLevel): Grid;
export function createState(g: Grid): SolverState;
export function step(g: Grid, s: SolverState, cell: number): SolverState | null;
export function solve(
  g: Grid,
  options?: { start?: number; bonus?: readonly number[]; orders?: boolean; nodeBudget?: number; from?: { path: readonly number[]; moves: number } | null },
): SolveResult;
export function minStart(g: Grid, max?: number): number | null;
export function greedy(g: Grid): { won: boolean; order: number[]; state: SolverState };
export function everySourceNeeded(g: Grid): boolean;
export function firstChoices(g: Grid): number[];
export function isTrapPick(level: SolverLevel): boolean;
export function validate(level: SolverLevel, options?: { needFirstChoices?: number }): SolverLevel | null;
