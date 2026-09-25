import type { Level } from '../engine/types.ts';

/** §6: уровень N — поле 6 × (N + 1). */
export const LEVELS: readonly Level[] = [1, 2, 3, 4, 5].map((id) => ({ id, cap: id + 1 }));

export const LEVEL_COUNT = LEVELS.length;

export function getLevel(id: number): Level {
  const level = LEVELS[id - 1];
  if (level === undefined) throw new Error(`no level ${String(id)}`);
  return level;
}
