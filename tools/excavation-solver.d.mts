// Типы для импорта солвера из тестов apps/excavation (TypeScript strict).

export interface LevelDef {
  readonly id: number;
  readonly rows: number;
  readonly cols: number;
  readonly traps: number;
  readonly safeBand: readonly [number, number];
  readonly clearable?: boolean;
  readonly stars: readonly [number, number, number];
}

export interface Room {
  readonly rows: number;
  readonly cols: number;
  readonly traps: number;
  readonly trap: readonly boolean[];
  readonly clue: readonly number[];
  readonly entrance: number;
  exit: number;
  readonly seed?: number;
}

export interface PlayResult {
  readonly gold: number;
  readonly stars: number;
  readonly failed: boolean;
  readonly guesses: number;
  readonly decisions: number;
}

export type Policy =
  | { readonly kind: 'random'; readonly target: number }
  | { readonly kind: 'logic'; readonly target: number; readonly maxRisk?: number };

export const LEVELS: readonly LevelDef[];
export const LAYOUTS_PER_LEVEL: number;
export const MAX_CLUE: number;
export const MIN_EXIT_DISTANCE: number;
export function mulberry32(seed: number): () => number;
export function neighbours(rows: number, cols: number, i: number): number[];
export function generateRoom(rows: number, cols: number, traps: number, seed: number): Room;
export function roomTotal(room: Room): number;
export function safeOnly(room: Room): { gold: number; cleared: boolean; open: boolean[] };
export function isValid(level: LevelDef, room: Room): boolean;
export function placeExit(room: Room, logicOpen: readonly boolean[]): number;
export function layoutsFor(level: LevelDef, count?: number, base?: number): Room[];
export function toMap(room: Room): string[];
export function roomFromMap(map: readonly string[], traps?: number): Room;
export function safeSequence(room: Room, open?: readonly boolean[]): number[];
export function trapProbabilities(room: Room, open: readonly boolean[]): Map<number, number>;
export function play(room: Room, level: LevelDef, policy: Policy, rnd: (() => number) | null): PlayResult;
export function evaluate(
  level: LevelDef,
  runsPerLayout?: number,
  layouts?: Room[],
): { out: Record<string, { win: number; stars: number; gold: number; s3: number; decisions: number }>; safeOnlyGold: number[]; totals: number[] };
