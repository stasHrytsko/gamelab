import { describe, expect, it } from 'vitest';
import { createState, freeNeighbours, nearestWaterDistance, reject, step } from '../src/engine/sproutEngine.ts';
import type { GameState, Level } from '../src/engine/types.ts';

// 6×6: А внизу слева, вода +2 справа от А, камень над А, Б вверху справа.
const level: Level = {
  id: 99,
  name: 'T',
  tutorial: true,
  start: 3,
  rows: ['.....B', '......', '......', '......', '#.....', 'A2....'],
};
const A = { row: 5, col: 0 };

const walk = (lvl: Level, cells: Array<[number, number]>, from: GameState = createState(lvl)): GameState => {
  let s = from;
  for (const [row, col] of cells) {
    const r = step(lvl, s, { row, col });
    if (r === null) throw new Error(`illegal step ${String(row)},${String(col)}`);
    s = r.state;
  }
  return s;
};

describe('шаг (§4)', () => {
  it('старт: корень — только А, запас из уровня', () => {
    const s = createState(level);
    expect(s.path).toEqual([A]);
    expect(s.moves).toBe(3);
    expect(s.status).toBe('playing');
  });

  it('шаг на землю стоит 1 ход', () => {
    const s = walk(level, [[5, 1], [5, 2]]);
    expect(s.moves).toBe(3 - 1 + 2 - 1);
    expect(s.path).toHaveLength(3);
  });

  it('вода: сначала −1, потом +X, бонус возвращается в результате', () => {
    const r = step(level, createState(level), { row: 5, col: 1 });
    expect(r?.bonus).toBe(2);
    expect(r?.state.moves).toBe(3 - 1 + 2);
  });

  it('в камень расти нельзя, ход не тратится', () => {
    const s = createState(level);
    expect(reject(level, s, { row: 4, col: 0 })).toBe('stone');
    expect(step(level, s, { row: 4, col: 0 })).toBeNull();
  });

  it('на клетку корня вернуться нельзя', () => {
    const s = walk(level, [[5, 1]]);
    expect(reject(level, s, A)).toBe('root');
    expect(step(level, s, A)).toBeNull();
  });

  it('не соседняя клетка и диагональ недопустимы', () => {
    const s = createState(level);
    expect(reject(level, s, { row: 5, col: 2 })).toBe('not_adjacent');
    expect(reject(level, s, { row: 4, col: 1 })).toBe('not_adjacent');
    expect(reject(level, s, A)).toBe('not_adjacent');
  });

  it('после конца попытки шаги недопустимы', () => {
    const lost = walk({ ...level, start: 1 }, [[5, 1]]); // вода +2 → запас 2
    const done = walk({ ...level, start: 1 }, [[5, 1], [5, 2], [5, 3]]);
    expect(lost.status).toBe('playing');
    expect(done.status).toBe('failed');
    expect(reject(level, done, { row: 5, col: 4 })).toBe('not_playing');
  });
});

describe('победа и поражение (§5)', () => {
  const nearB: Level = { ...level, rows: ['....B.', '......', '......', '......', '#.....', 'A2....'] };

  it('вход в Б последним ходом — победа', () => {
    const lvl: Level = { ...level, start: 1, rows: ['......', '......', '......', '......', '#.....', 'AB....'] };
    const s = walk(lvl, [[5, 1]]);
    expect(s.status).toBe('won');
    expect(s.moves).toBe(0);
  });

  it('запас 0 не на Б — moves_exhausted', () => {
    const s = walk({ ...nearB, start: 2 }, [[5, 1], [5, 2], [5, 3], [5, 4]]);
    expect(s.status).toBe('failed');
    expect(s.failReason).toBe('moves_exhausted');
  });

  it('вход в воду последним ходом разрешён и спасает', () => {
    const s = walk({ ...level, start: 1 }, [[5, 1]]);
    expect(s.status).toBe('playing');
    expect(s.moves).toBe(2);
  });

  it('тупик с запасом > 0 — no_moves', () => {
    // Коридор: А → (5,1) → (4,1), дальше камни и корень.
    const lvl: Level = { ...level, start: 5, rows: ['.....B', '......', '......', '##....', '#.#...', 'A.#...'] };
    const s = walk(lvl, [[5, 1], [4, 1]]);
    expect(freeNeighbours(lvl, s)).toHaveLength(0);
    expect(s.status).toBe('failed');
    expect(s.failReason).toBe('no_moves');
  });

  it('запас 0 и тупик одновременно — причина moves_exhausted', () => {
    const lvl: Level = { ...level, start: 2, rows: ['.....B', '......', '......', '##....', '#.#...', 'A.#...'] };
    const s = walk(lvl, [[5, 1], [4, 1]]);
    expect(s.failReason).toBe('moves_exhausted');
  });

  it('до Б уже не дойти, но шаг есть — игра продолжается молча', () => {
    const s = walk({ ...level, start: 3 }, [[5, 1], [5, 2]]); // запас 3, до Б далеко
    expect(s.status).toBe('playing');
  });
});

describe('лог (§8)', () => {
  it('расстояние до ближайшей невыпитой воды', () => {
    expect(nearestWaterDistance(level, createState(level))).toBe(1);
    expect(nearestWaterDistance(level, walk(level, [[5, 1]]))).toBeNull();
  });
});
