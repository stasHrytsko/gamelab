import type { Level } from '../engine/types.ts';

/**
 * Пять уровней. Подобраны солвером (`tools/gen-levels.ts`): 1–2 обучающие (лимит
 * оптимум+2, жадный выбор решает), 3–5 с ловушкой (лимит равен оптимуму, жадная
 * стратегия «всегда бери больше» не решает). `tests/levels.test.ts` сверяет это.
 */
export const LEVELS: readonly Level[] = [
  {
    id: 1,
    name: 'FB-T1',
    tutorial: true,
    moveLimit: 4,
    hero: { row: 2, col: 2 },
    enemies: [
      { id: '0', row: 2, col: 0 },
      { id: '1', row: 2, col: 1 },
      { id: '2', row: 2, col: 4 },
    ],
  },
  {
    id: 2,
    name: 'FB-T2',
    tutorial: true,
    moveLimit: 5,
    hero: { row: 1, col: 1 },
    enemies: [
      { id: '0', row: 3, col: 1 },
      { id: '1', row: 4, col: 1 },
      { id: '2', row: 0, col: 1 },
      { id: '3', row: 1, col: 0 },
    ],
  },
  {
    id: 3,
    name: 'FB-01',
    tutorial: false,
    moveLimit: 5,
    hero: { row: 0, col: 1 },
    enemies: [
      { id: '0', row: 0, col: 0 },
      { id: '1', row: 1, col: 0 },
      { id: '2', row: 2, col: 1 },
      { id: '3', row: 3, col: 1 },
      { id: '4', row: 0, col: 3 },
      { id: '5', row: 1, col: 3 },
    ],
  },
  {
    id: 4,
    name: 'FB-02',
    tutorial: false,
    moveLimit: 6,
    hero: { row: 2, col: 2 },
    enemies: [
      { id: '0', row: 1, col: 4 },
      { id: '1', row: 2, col: 4 },
      { id: '2', row: 3, col: 4 },
      { id: '3', row: 1, col: 0 },
      { id: '4', row: 1, col: 1 },
      { id: '5', row: 2, col: 1 },
    ],
  },
  {
    id: 5,
    name: 'FB-03',
    tutorial: false,
    moveLimit: 6,
    hero: { row: 1, col: 2 },
    enemies: [
      { id: '0', row: 1, col: 1 },
      { id: '1', row: 0, col: 3 },
      { id: '2', row: 1, col: 4 },
      { id: '3', row: 2, col: 4 },
      { id: '4', row: 3, col: 2 },
      { id: '5', row: 3, col: 3 },
      { id: '6', row: 3, col: 4 },
    ],
  },
];

export const LEVEL_COUNT = LEVELS.length;

export function getLevel(id: number): Level {
  const level = LEVELS[id - 1];
  if (level === undefined) throw new Error(`no level ${String(id)}`);
  return level;
}
