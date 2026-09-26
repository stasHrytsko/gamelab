import type { Level } from '../engine/types.ts';

/**
 * §6 спеки. Источник — `GAME_LEVELS` в `tools/arrow-flip-solver.mjs`: 1–2
 * обучающие (`tutorial: true`, проиграть нельзя), 3–5 с ловушкой (лимит без
 * запаса, жадная стратегия не решает). Числа не редактируются вручную —
 * `tests/levels.test.ts` сверяет их с солвером.
 */
export const LEVELS: readonly Level[] = [
  {
    id: 1,
    name: 'AF-T1',
    tutorial: true,
    moveLimit: 3,
    blocks: [
      { id: '0', row: 1, col: 2, dir: '<' },
      { id: '1', row: 3, col: 1, dir: 'v' },
      { id: '2', row: 2, col: 1, dir: '<' },
    ],
  },
  {
    id: 2,
    name: 'AF-T2',
    tutorial: true,
    moveLimit: 4,
    blocks: [
      { id: '0', row: 0, col: 1, dir: '>' },
      { id: '1', row: 1, col: 0, dir: '<' },
      { id: '2', row: 1, col: 1, dir: '>' },
      { id: '3', row: 1, col: 2, dir: '<' },
    ],
  },
  {
    id: 3,
    name: 'AF-01',
    tutorial: false,
    moveLimit: 6,
    blocks: [
      { id: '0', row: 0, col: 2, dir: '<' },
      { id: '1', row: 1, col: 1, dir: '<' },
      { id: '2', row: 0, col: 0, dir: 'v' },
      { id: '3', row: 1, col: 0, dir: '>' },
      { id: '4', row: 0, col: 3, dir: 'v' },
    ],
  },
  {
    id: 4,
    name: 'AF-03',
    tutorial: false,
    moveLimit: 8,
    blocks: [
      { id: '0', row: 1, col: 3, dir: '<' },
      { id: '1', row: 3, col: 3, dir: '<' },
      { id: '2', row: 0, col: 0, dir: 'v' },
      { id: '3', row: 0, col: 3, dir: '>' },
      { id: '4', row: 0, col: 2, dir: '<' },
      { id: '5', row: 3, col: 2, dir: '>' },
    ],
  },
  {
    id: 5,
    name: 'AF-04',
    tutorial: false,
    moveLimit: 9,
    blocks: [
      { id: '0', row: 3, col: 0, dir: '>' },
      { id: '1', row: 1, col: 3, dir: '<' },
      { id: '2', row: 1, col: 2, dir: '>' },
      { id: '3', row: 3, col: 2, dir: 'v' },
      { id: '4', row: 3, col: 1, dir: '^' },
      { id: '5', row: 0, col: 3, dir: 'v' },
      { id: '6', row: 0, col: 1, dir: '^' },
    ],
  },
];

export const LEVEL_COUNT = LEVELS.length;

export function getLevel(id: number): Level {
  const level = LEVELS[id - 1];
  if (level === undefined) throw new Error(`no level ${String(id)}`);
  return level;
}
