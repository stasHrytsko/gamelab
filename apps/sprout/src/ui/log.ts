// Лог для §8 спеки: пишется только на устройство. Посмотреть — в консоли
// браузера `JSON.parse(localStorage['sprout:log'])`. Метрику step_lost
// считает солвер по выгруженному логу: `node tools/sprout-solver.mjs log <file>`.
const KEY = 'sprout:log';
const LIMIT = 3000;

export type LogEvent =
  | { type: 'level_start'; level: number; attempt: number }
  | {
      type: 'step';
      level: number;
      attempt: number;
      /** Номер шага в попытке, с 1. */
      step: number;
      row: number;
      col: number;
      /** `+X` выпитой этим шагом воды, 0 если не вода. */
      bonus: number;
      /** Запас после шага. */
      moves: number;
      /** Расстояние от кончика до ближайшей невыпитой воды до шага (null — воды не достать). */
      nearestWater: number | null;
      /** Времени с предыдущего шага (или начала попытки), мс. */
      ms: number;
    }
  | { type: 'help_open'; level: number }
  | { type: 'level_win'; level: number; attempt: number; steps: number }
  | { type: 'level_fail'; level: number; attempt: number; reason: 'moves_exhausted' | 'no_moves' };

export function log(event: LogEvent): void {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown[];
    list.push({ ...event, t: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(-LIMIT)));
  } catch {
    // лог не критичен
  }
}

// Номер попытки на уровне в пределах открытой вкладки (§8: attempts_to_win).
const attempts = new Map<number, number>();
export function nextAttempt(level: number): number {
  const n = (attempts.get(level) ?? 0) + 1;
  attempts.set(level, n);
  return n;
}
