import type { Level } from '../engine/types.ts';

/**
 * Пять уровней. 1–3 обучающие, по одному правилу за раз: 1 — только толчок, 2 — только
 * рывок, 3 — впервые оба на одном шаге (лимит оптимум+2, жадный выбор решает). 4–5 —
 * ловушки, подобранные солвером (`tools/gen-levels.ts`): лимит равен оптимуму, жадная
 * стратегия «всегда бери больше» не решает. `tests/levels.test.ts` сверяет это.
 */
export const LEVELS: readonly Level[] = [
  {
    id: 1,
    name: 'FB-T1',
    tutorial: true,
    moveLimit: 4,
    tip: 'Прижми палец к врагу — увидишь ход. Отпусти — герой шагнёт и <b>толкнёт</b> его.',
    hand: { row: 2, col: 3 },
    hero: { row: 2, col: 1 },
    enemies: [
      { id: '0', row: 2, col: 3 },
      { id: '1', row: 2, col: 4 },
      { id: '2', row: 0, col: 2 },
    ],
  },
  {
    id: 2,
    name: 'FB-T2',
    tutorial: true,
    moveLimit: 4,
    tip: 'Враг сзади? Шагни <b>от него</b> — цепь <b>утянет</b> его за тобой.',
    hand: { row: 3, col: 2 },
    hero: { row: 2, col: 2 },
    enemies: [
      { id: '0', row: 3, col: 2 },
      { id: '1', row: 4, col: 2 },
      { id: '2', row: 1, col: 1 },
      { id: '3', row: 1, col: 0 },
    ],
  },
  {
    id: 3,
    name: 'FB-T3',
    tutorial: true,
    moveLimit: 4,
    tip: 'Один шаг — два варианта: <b>толкнуть</b> того, кто впереди, или <b>утянуть</b> тех, кто сзади. Выбери, кого убрать.',
    hero: { row: 2, col: 2 },
    enemies: [
      { id: '0', row: 2, col: 0 },
      { id: '1', row: 2, col: 1 },
      { id: '2', row: 2, col: 4 },
    ],
  },
  {
    id: 4,
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
