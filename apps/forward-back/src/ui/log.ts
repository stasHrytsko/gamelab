// Лог для §8 спеки: пишется только на устройство. Посмотреть — в консоли
// браузера `JSON.parse(localStorage['forward-back:log'])`.
const KEY = 'forward-back:log';
const LIMIT = 1000;

export type LogEvent =
  | { type: 'level_start'; level: number }
  | {
      type: 'move';
      level: number;
      dir: string;
      mode: 'forward' | 'back' | 'none';
      captured: number;
      /** Были ли обе линии доступны (настоящий выбор вперёд/назад). */
      choice: boolean;
      /** Взято меньше, чем предлагала другая линия (§ идея: выбор не жадный). */
      tookLess: boolean;
      /** Времени с предыдущего хода этой попытки, мс. */
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
