// Лог для §8 спеки: пишется только на устройство. Посмотреть — в консоли
// браузера `JSON.parse(localStorage['burning-land:log'])`. Метрику turn_lost
// считает солвер по выгруженному логу.
const KEY = 'burning-land:log';
const LIMIT = 3000;

export type LogEvent =
  | { type: 'level_start'; level: number; attempt: number }
  | {
      type: 'place';
      level: number;
      attempt: number;
      /** Номер хода в попытке, с 1. */
      turn: number;
      slot: number;
      letter: string;
      rot: number;
      /** Индексы клеток стены, `row * 8 + col`. */
      cells: number[];
      /** Сколько клеток фигуры попало на точки превью (front_share). */
      onPreview: number;
      /** Поворотов перед постановкой в этом ходу. */
      rotations: number;
      /** Неудачных отпусканий над полем в этом ходу. */
      failedDrops: number;
      /** Времени от начала хода до постановки, мс. */
      ms: number;
    }
  | { type: 'skip'; level: number; attempt: number; turn: number }
  | { type: 'help_open'; level: number }
  | { type: 'level_win'; level: number; attempt: number; turn: number; burned: number }
  | { type: 'level_fail'; level: number; attempt: number; reason: 'house_burned'; turn: number };

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
