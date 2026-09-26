// Лог для §8 спеки: пишется только на устройство. Посмотреть — в консоли
// браузера `JSON.parse(localStorage['build-pack:log'])`.
const KEY = 'build-pack:log';
const LIMIT = 3000;

export type LogEvent =
  | { type: 'level_start'; level: number }
  | {
      type: 'place';
      level: number;
      size: number;
      /** Клетки фигуры относительно её левого верхнего угла. */
      shape: number[][];
      /** Левый верхний угол фигуры на поле: [row, col]. */
      at: number[];
      /** Сколько раз игрок нажал «Очистить», собирая эту фигуру. */
      clears: number;
      /** От выбора числа до укладки. */
      ms: number;
    }
  | { type: 'help_open'; level: number }
  | { type: 'level_win'; level: number }
  | { type: 'level_fail'; level: number; reason: 'no_moves'; left: number[] };

export function log(event: LogEvent): void {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown[];
    list.push({ ...event, t: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(-LIMIT)));
  } catch {
    // лог не критичен
  }
}
