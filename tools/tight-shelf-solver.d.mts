// Типы для импорта солвера из тестов apps/tight-shelf (TypeScript strict).

export type Piece = string;
export type Rule = string;

export interface SolverLevel {
  readonly id: number;
  readonly seed?: number;
  readonly rules: readonly string[];
  readonly queue: readonly Piece[];
}

export interface PlaceResult {
  readonly board: (Piece | null)[];
  readonly lines: number;
  readonly cleared: number[];
}

export interface Report {
  readonly id: number;
  readonly solvable: boolean;
  readonly queue: number;
  readonly jokers: number;
  readonly choices: number;
  readonly traps: number;
  readonly firstTrap: number | null;
  readonly clears: number;
  readonly doubles: number;
  readonly greedy: boolean;
  readonly random: number;
  readonly blind: number;
  readonly preview1: number;
  readonly preview3: number;
}

export const SIZE: number;
export const COLORS: readonly string[];
export const SHAPES: readonly string[];
export const TYPES: readonly Piece[];
export const WINDOWS: readonly (readonly number[])[];
export function fits(rule: Rule, piece: Piece): boolean;
export function legal(rules: readonly Rule[], board: readonly (Piece | null)[], piece: Piece): number[];
export function place(board: readonly (Piece | null)[], cell: number, piece: Piece): PlaceResult;
export function flatRules(level: SolverLevel): Rule[];
export function makeSolver(level: SolverLevel): { rules: Rule[]; solvable(board: readonly (Piece | null)[], t: number): boolean };
export function solution(level: SolverLevel): number[] | null;
export function visibleTraps(level: SolverLevel, board: readonly (Piece | null)[], t: number): number[];
export function randomTrapRate(level: SolverLevel, runs?: number): number;
export function playBot(level: SolverLevel, bot: 'random' | 'greedy' | 'blind' | 'preview1' | 'preview3', seed?: number): { won: boolean; placed: number };
export function winRate(level: SolverLevel, bot: 'random' | 'greedy' | 'blind' | 'preview1' | 'preview3', runs: number): number;
export function report(level: SolverLevel, runs?: Partial<Record<'random' | 'blind' | 'preview1' | 'preview3', number>>): Report;
