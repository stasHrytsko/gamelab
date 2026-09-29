import { describe, expect, it } from 'vitest';
import { apply, colorProgress, createState, hasAnyMove, isWon, planReturn, planSwipe, starsFor, swipe, swipeDir, tapFlask } from '../src/engine/gapEngine.ts';
import type { Cell, Color, Level } from '../src/engine/types.ts';

// Поле 3×2, выход 1 справа в верхней строке (→), выход 2 слева в нижней (←).
//   . a .   →1
//   . . b
const base = (over: Partial<Level> = {}): Level => ({
  id: 99, name: 'T', tutorial: false, seed: 0, w: 3, h: 2,
  exits: [{ x: 2, y: 0, dx: 1, dy: 0 }, { x: 0, y: 1, dx: -1, dy: 0 }],
  caps: [2, 2],
  field: [0, 1, 0, 0, 0, 2] as Cell[],
  flasks: [[], []] as Color[][],
  opt: 4, limit: 8, stars3: 5, stars2: 6, minReturns: 0, solution: [],
  ...over,
});

describe('скольжение (§4 п.1–6)', () => {
  it('квадрат едет до края и падает в колбу выхода', () => {
    const level = base();
    const out = swipe(level, createState(level), 1, 0, 'right');
    expect(out?.move.kind).toBe('in');
    expect(out?.state.flasks[0]).toEqual([1]);
    expect(out?.state.field[1]).toBe(0);
    expect(out?.state.moves).toBe(1);
  });

  it('без выхода на конце квадрат останавливается у края', () => {
    const level = base();
    const out = swipe(level, createState(level), 1, 0, 'left');
    expect(out?.move.kind).toBe('slide');
    expect(out?.state.field[0]).toBe(1);
  });

  it('упор сразу и без выхода — недопустимый ход', () => {
    const level = base();
    expect(swipe(level, createState(level), 1, 0, 'up')).toBeNull();
  });

  it('проезд мимо чужого выхода вдоль рамки в колбу не ведёт', () => {
    // b едет влево по нижней строке: клетка (0,1) — выход 2, но смотрит ←, значит въезд.
    const level = base();
    expect(swipe(level, createState(level), 2, 1, 'left')?.move.kind).toBe('in');
    // а вверх из (2,1) в (2,0) — выход 1 смотрит →, свайп вверх выхода не даёт.
    const up = swipe(level, createState(level), 2, 1, 'up');
    expect(up?.move.kind).toBe('slide');
    expect(up?.state.flasks[0]).toEqual([]);
  });

  it('квадрат на клетке выхода уходит свайпом к щели без шага', () => {
    const level = base({ field: [0, 0, 1, 0, 0, 2] as Cell[] });
    const out = swipe(level, createState(level), 2, 0, 'right');
    expect(out?.move.kind).toBe('in');
    expect(out?.move.steps).toBe(0);
  });

  it('полная колба: квадрат останавливается на клетке выхода', () => {
    const level = base({ flasks: [[2, 2], []] as Color[][], field: [0, 1, 0, 0, 0, 0] as Cell[] });
    const out = swipe(level, createState(level), 1, 0, 'right');
    expect(out?.move.kind).toBe('slide');
    expect(out?.state.field[2]).toBe(1);
  });

  it('полная колба и квадрат уже на клетке выхода: хода нет', () => {
    const level = base({ flasks: [[2, 2], []] as Color[][], field: [0, 0, 1, 0, 0, 0] as Cell[] });
    expect(swipe(level, createState(level), 2, 0, 'right')).toBeNull();
  });

  it('свайп по пустой клетке и по стене ничего не делает', () => {
    const level = base({ field: [-1, 1, 0, 0, 0, 0] as Cell[] });
    expect(planSwipe(level, createState(level), 0, 0, 'right')).toBeNull();
    expect(planSwipe(level, createState(level), 2, 1, 'left')).toBeNull();
  });
});

describe('возврат из колбы (§4 п.7–9)', () => {
  it('верхний квадрат выходит на клетку выхода', () => {
    const level = base({ field: [0, 0, 0, 0, 0, 0] as Cell[], flasks: [[1, 2], []] as Color[][] });
    const out = tapFlask(level, createState(level), 1);
    expect(out?.move.kind).toBe('return');
    expect(out?.state.field[2]).toBe(2);
    expect(out?.state.flasks[0]).toEqual([1]);
  });

  it('клетка выхода занята — возврата нет, ход не тратится', () => {
    const level = base({ field: [0, 0, 1, 0, 0, 0] as Cell[], flasks: [[2], []] as Color[][] });
    expect(planReturn(level, createState(level), 1)).toBeNull();
    expect(tapFlask(level, createState(level), 1)).toBeNull();
  });

  it('пустая колба — возврата нет', () => {
    const level = base();
    expect(tapFlask(level, createState(level), 2)).toBeNull();
  });
});

describe('победа, поражение, звёзды (§5)', () => {
  it('победа: поле пусто, колбы одноцветны, цвет в одной колбе', () => {
    expect(isWon([0, 0], [[1, 1], [2]])).toBe(true);
    expect(isWon([0, 1], [[1, 1], [2]])).toBe(false);
    expect(isWon([0, 0], [[1, 2], []])).toBe(false);
    expect(isWon([0, 0], [[1], [1]])).toBe(false);
  });

  it('последний квадрат в колбу — победа со звёздами по числу ходов', () => {
    const level = base({ field: [0, 1, 0, 0, 0, 0] as Cell[], flasks: [[], [2]] as Color[][], stars3: 1, stars2: 2, limit: 3 });
    const out = swipe(level, createState(level), 1, 0, 'right');
    expect(out?.state.status).toBe('won');
    expect(out?.state.stars).toBe(3);
  });

  it('лимит ходов: ход, после которого moves ≥ limit без победы, — поражение', () => {
    const level = base({ limit: 1 });
    const out = swipe(level, createState(level), 1, 0, 'left');
    expect(out?.state.status).toBe('failed');
    expect(out?.state.failReason).toBe('moves_exhausted');
  });

  it('победа на последнем допустимом ходе важнее лимита', () => {
    const level = base({ field: [0, 1, 0, 0, 0, 0] as Cell[], flasks: [[], [2]] as Color[][], limit: 1, stars3: 1, stars2: 1 });
    expect(swipe(level, createState(level), 1, 0, 'right')?.state.status).toBe('won');
  });

  it('нет ходов: квадрат в углу без свободных соседей и колбы заперты', () => {
    // один квадрат зажат стенами, колбы пусты — ни свайпа, ни возврата.
    const level = base({ w: 2, h: 1, exits: [{ x: 1, y: 0, dx: 0, dy: -1 }, { x: 1, y: 0, dx: 1, dy: 0 }], field: [1, -1] as Cell[], limit: 9 });
    const s = { ...createState(level), field: [1, -1] as Cell[] };
    expect(hasAnyMove(level, s)).toBe(false);
  });

  it('звёзды: границы opt + 2 и ceil(1.5 × opt)', () => {
    const level = base({ opt: 10, stars3: 12, stars2: 15, limit: 20 });
    expect([10, 12, 13, 15, 16, 20].map((m) => starsFor(level, m))).toEqual([3, 3, 2, 2, 1, 1]);
  });

  it('после победы или поражения ходы не принимаются', () => {
    const level = base({ limit: 1 });
    const failed = swipe(level, createState(level), 1, 0, 'left');
    expect(failed).not.toBeNull();
    expect(failed && apply(level, failed.state, { type: 'swipe', x: 0, y: 0, dir: 'right' })).toBeNull();
  });
});

describe('свайп по смещению (§4)', () => {
  it('порог 24 px и доминирующая ось', () => {
    expect(swipeDir(10, 10)).toBeNull();
    expect(swipeDir(30, 5)).toBe('right');
    expect(swipeDir(-30, 5)).toBe('left');
    expect(swipeDir(5, -30)).toBe('up');
    expect(swipeDir(5, 40)).toBe('down');
  });
});

describe('счётчики целей (§7)', () => {
  it('цвет собран, когда все его квадраты лежат в одной одноцветной колбе', () => {
    const level = base({ field: [0, 0, 0, 0, 0, 0] as Cell[], flasks: [[1, 1], [2]] as Color[][] });
    expect(colorProgress(level, createState(level))).toEqual([
      { color: 1, have: 2, total: 2, done: true },
      { color: 2, have: 1, total: 1, done: true },
    ]);
  });

  it('квадрат на поле или в смешанной колбе не считается собранным', () => {
    const level = base({ field: [0, 0, 1, 0, 0, 0] as Cell[], flasks: [[2, 1], [2]] as Color[][] });
    const p = colorProgress(level, createState(level));
    expect(p.find((c) => c.color === 1)).toEqual({ color: 1, have: 0, total: 2, done: false });
    expect(p.find((c) => c.color === 2)).toEqual({ color: 2, have: 1, total: 2, done: false });
  });
});
