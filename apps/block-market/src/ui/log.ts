// Лог для проверки на игроках: пишется только на устройство. Посмотреть — в
// консоли браузера `JSON.parse(localStorage['block-market:log'])`.
const KEY = 'block-market:log';
const LIMIT = 1000;

export type LogEvent =
  | { type: 'level_start'; level: number; seed: number; coins: number }
  | {
      type: 'place';
      level: number;
      /** Сколько фигур уже сыграно или сгорело до этой. */
      turn: number;
      /** С какого из трёх мест на руке взята фигура. */
      slot: number;
      piece: string;
      /** Сколько мест было у фигуры как есть. */
      fits: number;
      lines: number;
      income: number;
      /** Сколько монет реально добавилось (остальное не влезло в кошелёк). */
      gained: number;
      coins: number;
      burned: number;
    }
  | { type: 'buy'; level: number; slot: number; purchase: 'rotate' | 'mirror' | 'swap' | 'reroll'; piece: string; cost: number; coins: number; burned: number }
  | { type: 'buy_refused'; level: number; purchase: 'rotate' | 'mirror' | 'swap' | 'reroll'; reason: 'no_coins' | 'no_change' }
  | { type: 'help_open'; level: number }
  | { type: 'level_win'; level: number; lines: number; goal: number; coins: number }
  | { type: 'level_fail'; level: number; reason: 'goal_missed'; lines: number; goal: number; levelsCleared: number }
  | { type: 'run_win'; levelsCleared: number };

export function log(event: LogEvent): void {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown[];
    list.push({ ...event, t: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(-LIMIT)));
  } catch {
    // лог не критичен
  }
}
