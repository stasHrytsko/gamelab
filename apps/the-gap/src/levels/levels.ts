import type { Action, Cell, Color, Exit, Level } from '../engine/types.ts';
import data from './levels.json' with { type: 'json' };

interface Row {
  readonly id: string;
  readonly seed: number;
  readonly w: number;
  readonly h: number;
  readonly exits: readonly Exit[];
  readonly caps: readonly number[];
  readonly field: readonly Cell[];
  readonly flasks: readonly (readonly Color[])[];
  readonly opt: number;
  readonly limit: number;
  readonly stars3: number;
  readonly stars2: number;
  readonly minReturns: number;
  readonly solution: readonly Action[];
}

// Пять уровней из tools/the-gap-levels.json (specs/40-the-gap.md §6): каждый
// задан `cfg + seed` в tools/the-gap-solver.mjs, проверен солвером и хранит его
// оптимальное решение. Тест сверяет копию с файлом в tools/. Обучающие — 1–2.
export const LEVELS: readonly Level[] = (data as unknown as readonly Row[]).map((row, i) => ({
  id: i + 1,
  name: row.id,
  tutorial: i < 2,
  seed: row.seed,
  w: row.w,
  h: row.h,
  exits: row.exits,
  caps: row.caps,
  field: row.field,
  flasks: row.flasks,
  opt: row.opt,
  limit: row.limit,
  stars3: row.stars3,
  stars2: row.stars2,
  minReturns: row.minReturns,
  solution: row.solution,
}));

export const LEVEL_COUNT = LEVELS.length;

export function getLevel(n: number): Level {
  const level = LEVELS[n - 1];
  if (level === undefined) throw new Error(`no level ${String(n)}`);
  return level;
}
