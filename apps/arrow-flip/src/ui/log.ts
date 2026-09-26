// Лог для §8 спеки: пишется только на устройство. Посмотреть — в консоли
// браузера `JSON.parse(localStorage['arrow-flip:log'])`.
const KEY = 'arrow-flip:log';
const LIMIT = 3000;

export type LogEvent =
  | { type: 'level_start'; level: number }
  | {
      type: 'tap';
      level: number;
      blockId: string;
      /** Был ли блок готов к выходу до этого тапа (§8: setup vs bait). */
      exitReady: boolean;
      exited: boolean;
      touched: number;
      /** Времени с предыдущего тапа этой попытки, мс. */
      ms: number;
    }
  | { type: 'help_open'; level: number }
  | { type: 'level_win'; level: number; moves: number }
  | { type: 'level_fail'; level: number; reason: 'moves_exhausted' | 'no_moves' };

export function log(event: LogEvent): void {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown[];
    list.push({ ...event, t: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(-LIMIT)));
  } catch {
    // лог не критичен
  }
}
