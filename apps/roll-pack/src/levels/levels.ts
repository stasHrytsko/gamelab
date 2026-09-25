import type { Level } from '../engine/types.ts';

/**
 * §6. `.` — пустая клетка, `#` — препятствие внутри поля, пробел — клетка вне
 * формы поля (не рисуется). Раскладки подобраны солвером: решение есть,
 * «змейка» не решает уровни 2–5, решений всё меньше к уровню 5.
 */
export const LEVELS: readonly Level[] = [
  { id: 1, numbers: [7, 7, 6, 5, 5, 4], map: ['#.....', '......', '......', '......', '......', '.....#'] },
  { id: 2, numbers: [7, 7, 6, 5, 4, 4], map: ['......', '......', '..#...', '....#.', '.#....', '......'] },
  { id: 3, numbers: [7, 7, 7, 6], map: ['...   ', '...   ', '...   ', '......', '......', '......'] },
  { id: 4, numbers: [6, 6, 6, 6, 6], map: [' .... ', ' .... ', '......', '......', '....#.', '....#.'] },
  { id: 5, numbers: [7, 5, 5, 5, 4], map: ['....  ', ' .....', '  ...#', '......', '.#..  ', ' .....'] },
];

export const LEVEL_COUNT = LEVELS.length;

export function getLevel(id: number): Level {
  const level = LEVELS[id - 1];
  if (level === undefined) throw new Error(`no level ${String(id)}`);
  return level;
}
