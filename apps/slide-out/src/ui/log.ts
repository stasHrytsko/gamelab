// Лог для §8 спеки: пишется только на устройство. Посмотреть — в консоли
// браузера `JSON.parse(localStorage['slide-out:log'])`.
const KEY = 'slide-out:log';
const LIMIT = 3000;

export type LogEvent =
  | { type: 'level_start'; level: number }
  | { type: 'move'; level: number; color: string; urgent: string | null; waiting: string[] }
  | { type: 'help_open'; level: number }
  | { type: 'level_win'; level: number; moves: number }
  | { type: 'level_fail'; level: number; moves: number; reason: 'goal_timeout' };

export function log(event: LogEvent): void {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown[];
    list.push({ ...event, at: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(-LIMIT)));
  } catch {
    // лог не критичен
  }
}
