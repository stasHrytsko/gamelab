// Типы для импорта солвера из тестов apps/the-gap (TypeScript strict).

export interface SolverLevel {
  w: number;
  h: number;
  exits: { x: number; y: number; dx: number; dy: number }[];
  caps: number[];
  field: number[];
  flasks: number[][];
}
export interface SolverState {
  field: number[];
  flasks: number[][];
}
export interface SolverMove extends SolverState {
  kind: 'in' | 'slide' | 'ret';
  act: { type: 'swipe'; x: number; y: number; dir: string } | { type: 'tap-flask'; n: number };
}
export function moves(level: SolverLevel, state: SolverState, allowReturn: boolean): SolverMove[];
export function isWin(level: SolverLevel, state: SolverState): boolean;
export function explore(level: SolverLevel, allowReturn: boolean, cap?: number): { nodes: SolverState[]; edges: { to: number; kind: string }[][]; parent: unknown[] } | null;
