// Лог для §8 спеки: пишется только на устройство. Посмотреть — в консоли
// браузера `JSON.parse(localStorage['excavation:log'])`. Стопы, их исход,
// take_share и careless_taps считает солвер по выгруженному логу:
// `node tools/excavation-solver.mjs log <file.json>`.
const KEY = 'excavation:log';
const LIMIT = 3000;

export type LogEvent =
  | { type: 'level_start'; level: number; attempt: number; layout: number; seed: number }
  | {
      type: 'tap';
      level: number;
      attempt: number;
      row: number;
      col: number;
      result: 'safe' | 'exit' | 'trap';
      /** Золото попытки после тапа (0 после ловушки). */
      gold: number;
      /** Времени с предыдущего действия (или начала попытки), мс. */
      ms: number;
    }
  | { type: 'take'; level: number; attempt: number; gold: number; stars: number; left: number; ms: number }
  | { type: 'level_win'; level: number; attempt: number; outcome: 'take' | 'cleared'; gold: number; stars: number }
  | { type: 'level_fail'; level: number; attempt: number; reason: 'trap'; lostGold: number }
  | { type: 'abandon'; level: number; attempt: number; gold: number }
  | { type: 'take_blocked'; level: number; attempt: number; why: 'no_exit' | 'no_gold' }
  | { type: 'clue_tip'; level: number }
  | { type: 'help_open'; level: number };

export function log(event: LogEvent): void {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown[];
    list.push({ ...event, t: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(-LIMIT)));
  } catch {
    // лог не критичен
  }
}
