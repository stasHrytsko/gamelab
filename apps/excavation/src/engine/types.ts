/**
 * Раскоп — типы по §3 спеки (`specs/24-excavation.md`).
 * Плита адресуется `row` (сверху вниз, с 0) и `col` (слева направо, с 0);
 * внутри движка — индекс `row * cols + col`.
 */

/** Раскладка из `levels.json`: `*` ловушка, `.` безопасная плита, `E` вход, `X` выход. */
export interface Layout {
  readonly seed: number;
  readonly map: readonly string[];
}

export interface Level {
  readonly id: number;
  readonly rows: number;
  readonly cols: number;
  readonly traps: number;
  /** Пороги 1★ / 2★ / 3★ по возрастанию. */
  readonly stars: readonly [number, number, number];
  readonly layouts: readonly Layout[];
}

export type Status = 'playing' | 'won' | 'failed';
export type FailReason = 'trap';
export type Stars = 0 | 1 | 2 | 3;

export interface GameState {
  readonly level: Level;
  /** Индекс раскладки уровня, 0..19. */
  readonly layout: number;
  readonly rows: number;
  readonly cols: number;
  readonly trap: readonly boolean[];
  /** Ловушек среди 8 соседей; у ловушки −1. Это же — золото плиты. */
  readonly clue: readonly number[];
  readonly open: readonly boolean[];
  readonly entrance: number;
  readonly exit: number;
  readonly gold: number;
  readonly exitFound: boolean;
  readonly status: Status;
  readonly failReason: FailReason | null;
  /** Сколько золота сгорело на ловушке — для попапа. */
  readonly lostGold: number;
  /** Индекс сработавшей ловушки, −1 если нет. */
  readonly trapHit: number;
}

/** Результат тапа по плите: новое состояние и что произошло (для анимации и лога). */
export interface TapResult {
  readonly state: GameState;
  readonly index: number;
  readonly kind: 'safe' | 'exit' | 'trap';
  /** Золото, которое принесла плита (0 у ловушки). */
  readonly gained: number;
  /** Открыта последняя безопасная плита — победа без «Забрать». */
  readonly cleared: boolean;
}
