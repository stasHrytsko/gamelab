// Лог для §8 спеки: пишется только на устройство. Посмотреть — в консоли
// браузера `JSON.parse(localStorage['the-gap:log'])`.
const KEY = 'the-gap:log';
const LIMIT = 1000;

export type LogEvent =
  | { type: 'level_start'; level: number }
  | {
      type: 'move';
      level: number;
      attempt: number;
      /** Номер хода в попытке. */
      n: number;
      kind: 'swipe' | 'return';
      /** Ход совпал со следующим ходом сохранённого оптимального решения, и все предыдущие тоже (§8). */
      onSolution: boolean;
      /** Сколько возвратов уже сделано в попытке, включая этот. */
      returns: number;
      /** Времени с предыдущего хода этой попытки, мс. */
      ms: number;
    }
  | { type: 'help_open'; level: number }
  | { type: 'level_win'; level: number; moves: number; stars: number; returns: number; divergedAt: number | null }
  | { type: 'level_fail'; level: number; reason: 'moves_exhausted' | 'no_moves'; divergedAt: number | null }
  | { type: 'demo_open'; level: number };

export function log(event: LogEvent): void {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown[];
    list.push({ ...event, t: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(-LIMIT)));
  } catch {
    // лог не критичен
  }
}
