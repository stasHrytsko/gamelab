import type { Level } from '../engine/types.ts';
import data from './levels.json';

/**
 * §6 спеки. `levels.json` — вывод `node tools/excavation-solver.mjs json`
 * (20 замороженных раскладок на уровень). Руками не редактируется —
 * `tests/levels.test.ts` сверяет копию с солвером.
 */
export const LEVELS: readonly Level[] = data as unknown as readonly Level[];

export const LEVEL_COUNT = LEVELS.length;

export function getLevel(id: number): Level {
  const level = LEVELS[id - 1];
  if (level === undefined) throw new Error(`no level ${String(id)}`);
  return level;
}
