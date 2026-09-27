import type { Level } from '../engine/types.ts';

/**
 * §6 спеки. Источник — `GAME_LEVELS` в `tools/sprout-solver.mjs`: 1–2
 * обучающие (запас с люфтом), 3–5 с ловушкой (запас без люфта, ближайшая
 * вода — приманка). Руками не редактируются — `tests/levels.test.ts`
 * сверяет копию с солвером.
 */
export const LEVELS: readonly Level[] = [
  {
    id: 1,
    name: 'SP-T1',
    tutorial: true,
    start: 7,
    rows: ['B.....', '...#..', '......', '#6....', '......', '.#.A#.'],
  },
  {
    id: 2,
    name: 'SP-T2',
    tutorial: true,
    start: 4,
    rows: ['B.....', '#.....', '#...#.', '.#....', '...5..', '.A.5.#'],
  },
  {
    id: 3,
    name: 'SP-4-1992',
    tutorial: false,
    start: 4,
    rows: ['...6B.', '.#..#.', '..####', '..#.4.', '6..#3.', '.....A'],
  },
  {
    id: 4,
    name: 'SP-5-21657',
    tutorial: false,
    start: 4,
    rows: ['B.####', '#...2.', '.##...', '....2.', '522..#', '....A.'],
  },
  {
    id: 5,
    name: 'SP-6-1630',
    tutorial: false,
    start: 4,
    rows: ['..#..B', '4..#3#', '3.2#..', '.#3.#.', '4#....', '...A#.'],
  },
];

export const LEVEL_COUNT = LEVELS.length;

export function getLevel(id: number): Level {
  const level = LEVELS[id - 1];
  if (level === undefined) throw new Error(`no level ${String(id)}`);
  return level;
}
