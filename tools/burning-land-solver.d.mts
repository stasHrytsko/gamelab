// Типы для импорта солвера из тестов apps/burning-land (TypeScript strict).

export interface SolverLevel {
  readonly name: string;
  readonly rows: readonly string[];
  readonly shapes: string;
  readonly tutorial?: boolean;
  readonly seed?: number;
}

export interface Move {
  readonly letter: 'M' | 'D' | 'I' | 'V' | 'O' | 'L' | 'S' | 'T';
  /** Индекс поворота в порядке поворота по часовой (как тап в игре). */
  readonly rot: number;
  /** Якорь — клетка `0,0` повёрнутой фигуры. */
  readonly row: number;
  readonly col: number;
  readonly cells: readonly number[];
  readonly slot: number;
}

export interface SolveResult {
  readonly solvable: boolean;
  /** Постановки по ходам; `null` — ход, где полезных постановок нет (любая равна пропуску). */
  readonly line: ReadonlyArray<Move | null> | null;
  readonly nodes: number;
  readonly aborted: boolean;
}

export interface PolicyResult {
  readonly won: boolean;
  readonly turns: number;
  readonly log: ReadonlyArray<Move | null>;
  readonly grid: Uint8Array;
}

export interface FirstMoves {
  readonly total: number;
  readonly wins: number;
  readonly unknown: number;
}

export interface RotationOpts {
  /** Общий лимит поворотов на всю партию (не на ход), нарастающим итогом. По умолчанию — без лимита. */
  readonly rotationBudget?: number;
}

export function rotationCount(letter: string): number;
export function tapCost(letter: string, rot: number): number;
export const N: number;
export const GAME_LEVELS: readonly SolverLevel[];
export function parse(level: SolverLevel): Uint8Array;
export function toRows(grid: Uint8Array): string[];
export function solve(level: SolverLevel, opts?: { nodeBudget?: number; from?: Uint8Array; turn?: number } & RotationOpts): SolveResult;
export function greedyFront(level: SolverLevel, opts?: RotationOpts): PolicyResult;
export function greedyHouse(level: SolverLevel, opts?: RotationOpts): PolicyResult;
export function winsWithoutWalls(level: SolverLevel): boolean;
export function isTrapPick(level: SolverLevel): FirstMoves | null;
export function tutorialPick(level: SolverLevel): FirstMoves | null;
export function winningFirstMoves(level: SolverLevel, nodeBudget?: number, opts?: RotationOpts): FirstMoves;
export function turnMoves(grid: Uint8Array, letters: readonly string[]): Move[];
export function triple(queue: string, turn: number): string[];
export function nextBurn(grid: Uint8Array): Set<number>;
export function shapeQueue(seed: number, turns?: number): string;
export function randomLevel(seed: number, cfg?: Record<string, number>): SolverLevel | null;
export function burned(grid: Uint8Array): number;
export function saved(grid: Uint8Array): number;
export function replay(level: SolverLevel, line: ReadonlyArray<Move | null>): { readonly status: string; readonly grid: Uint8Array; readonly turns?: number };
export function moveName(move: Move | null): string;
