// Числа игры. Правила — ideas/backlog/41-block-market.md, «Правила v2»;
// здесь они собраны в одном месте, чтобы подкручивать баланс без охоты по коду.
export const CFG = {
  SIZE: 8,
  /** Фигур на уровень: сыграна или сгорела — считается. */
  PIECES: 20,
  START_COINS: 5,
  /** Потолок кошелька: всё сверх сгорает. */
  CAP: 10,
  /** Монет за пройденный уровень. */
  LEVEL_BONUS: 1,
  MAX_LEVELS: 12,
  ROTATE_COST: 2,
  MIRROR_COST: 2,
  REROLL_COST: 2,
  /** Надбавка к базовой цене фигуры при замене. */
  SWAP_ADD: 2,
  /** Неудобную фигуру сдают каждым N-м ходом. */
  HOSTILE_EVERY: 2,
} as const;

/** Линий на уровне L (L с 1): 5 → 9 и дальше не растёт. */
export const goalFor = (level: number): number => Math.min(4 + Math.ceil(level * 0.8), 9);

/** Заполненных клеток на старте уровня. */
export const blockersFor = (level: number): number => Math.min(2 + level, 12);

/** Из скольких случайных кандидатов сдаётся самая неудобная. */
export const hostileK = (level: number): number => Math.min(2 + Math.ceil(level / 2), 5);

/** Доход за n линий за один ход: 1, 4, 9, 16… */
export const incomeFor = (lines: number): number => lines * lines;
