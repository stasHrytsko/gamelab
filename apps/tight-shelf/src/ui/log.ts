// Лог для §8 спеки: пишется только на устройство. Посмотреть — в консоли
// браузера `JSON.parse(localStorage['tight-shelf:log'])`. Долю ходов в видимую
// ловушку считает `node tools/tight-shelf-solver.mjs --log <файл>`.
const KEY = 'tight-shelf:log';
const LIMIT = 1000;

export type LogEvent =
  | { type: 'level_start'; level: number }
  | {
      type: 'place';
      level: number;
      /** Номер фигуры в очереди, с 0. */
      turn: number;
      piece: string;
      cell: number;
      /** Сколько клеток подходило этой фигуре. */
      legal: number;
      /** Сколько линий исчезло: 2+ — двойная очистка. */
      lines: number;
    }
  | { type: 'help_open'; level: number }
  | { type: 'level_win'; level: number }
  | { type: 'level_fail'; level: number; reason: 'no_moves'; turn: number };

export function log(event: LogEvent): void {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown[];
    list.push({ ...event, t: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(-LIMIT)));
  } catch {
    // лог не критичен
  }
}
