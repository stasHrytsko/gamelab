import type { Level } from '../engine/types.ts';
import data from './levels.json';

/**
 * §6. Копия tools/tight-shelf-levels.json: поле (цвет B/Y/C, форма o/s/t,
 * `.` — любая фигура) и очередь. Levels подобраны солвером
 * tools/tight-shelf-solver.mjs; tests/levels.test.ts проверяет, что копия
 * совпадает с оригиналом.
 */
export const LEVELS = data as readonly Level[];

export const LEVEL_COUNT = LEVELS.length;

export function getLevel(id: number): Level {
  const level = LEVELS[id - 1];
  if (level === undefined) throw new Error(`no level ${String(id)}`);
  return level;
}
