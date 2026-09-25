// Лог для §8 спеки: пишется только на устройство. Посмотреть — в консоли
// браузера `JSON.parse(localStorage['roll-pack:log'])`.
const KEY = 'roll-pack:log';
const LIMIT = 3000;

export type LogEvent =
  | { type: 'level_start'; level: number }
  | {
      type: 'move';
      level: number;
      dice: number[];
      chosen: number;
      x: number;
      heights: number[];
      dieSwitches: number;
      decisionMs: number;
    }
  | { type: 'help_open'; level: number }
  | { type: 'level_win'; level: number; planks: number }
  | { type: 'level_fail'; level: number; planks: number; reason: 'no_fit'; heights: number[]; dice: number[] };

export function log(event: LogEvent): void {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown[];
    list.push({ ...event, at: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(-LIMIT)));
  } catch {
    // лог не критичен
  }
}
