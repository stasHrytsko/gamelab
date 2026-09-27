import { describe, expect, it } from 'vitest';
import { canTake, createState, goldLeft, safeLeft, starsFor, take, takeBlock, tap } from '../src/engine/digEngine.ts';
import type { GameState, Level } from '../src/engine/types.ts';

// Маленькая комната 4×4 для правил §4–5:
//   * . . X      ловушки: (0,0) и (3,3); вход (3,0); выход (0,3)
//   . . . .
//   . . . .
//   E . . *
const LEVEL: Level = {
  id: 9,
  rows: 4,
  cols: 4,
  traps: 2,
  stars: [2, 3, 4],
  layouts: [{ seed: 1, map: ['*..X', '....', '....', 'E..*'] }],
};

const tapAll = (s: GameState, cells: ReadonlyArray<readonly [number, number]>): GameState =>
  cells.reduce((st, [r, c]) => {
    const res = tap(st, r, c);
    if (res === null) throw new Error(`tap ${String(r)},${String(c)} rejected`);
    return res.state;
  }, s);

describe('движок (§4–5)', () => {
  it('старт: открыт только вход, золото 0, выход не найден', () => {
    const s = createState(LEVEL, 0);
    expect(s.open.filter(Boolean)).toHaveLength(1);
    expect(s.open[s.entrance]).toBe(true);
    expect(s.gold).toBe(0);
    expect(s.exitFound).toBe(false);
    expect(s.clue[s.entrance]).toBe(0);
  });

  it('число плиты = ловушек среди 8 соседей = золото с неё', () => {
    const s = createState(LEVEL, 0);
    expect(s.clue[1]).toBe(1); // (0,1) рядом с (0,0)
    expect(s.clue[5]).toBe(1); // (1,1) по диагонали от (0,0)
    expect(s.clue[10]).toBe(1); // (2,2) по диагонали от (3,3)
    expect(s.clue[6]).toBe(0);
    const r = tap(s, 0, 1);
    expect(r?.kind).toBe('safe');
    expect(r?.gained).toBe(1);
    expect(r?.state.gold).toBe(1);
  });

  it('пустая плита (0) открывается и золота не даёт', () => {
    const r = tap(createState(LEVEL, 0), 1, 2);
    expect(r?.gained).toBe(0);
    expect(r?.state.gold).toBe(0);
    expect(r?.state.open[6]).toBe(true);
  });

  it('тап по открытой плите и по входу — ничего', () => {
    const s = tapAll(createState(LEVEL, 0), [[0, 1]]);
    expect(tap(s, 0, 1)).toBeNull();
    expect(tap(s, 3, 0)).toBeNull();
    expect(tap(s, 9, 9)).toBeNull();
  });

  it('выход: найден при открытии, даёт своё число золота, повторный тап — ничего', () => {
    const r = tap(createState(LEVEL, 0), 0, 3);
    expect(r?.kind).toBe('exit');
    expect(r?.state.exitFound).toBe(true);
    expect(r?.gained).toBe(0);
    expect(tap(r?.state as GameState, 0, 3)).toBeNull();
  });

  it('ловушка: поражение trap, золото сгорает, lostGold запоминает сколько', () => {
    const s = tapAll(createState(LEVEL, 0), [[0, 1], [1, 0]]);
    expect(s.gold).toBe(2);
    const r = tap(s, 0, 0);
    expect(r?.kind).toBe('trap');
    expect(r?.state.status).toBe('failed');
    expect(r?.state.failReason).toBe('trap');
    expect(r?.state.gold).toBe(0);
    expect(r?.state.lostGold).toBe(2);
    expect(r?.state.trapHit).toBe(0);
    expect(tap(r?.state as GameState, 1, 1)).toBeNull();
  });

  it('«Забрать» неактивна без выхода, даже с золотом', () => {
    const s = tapAll(createState(LEVEL, 0), [[0, 1], [1, 0], [1, 1]]);
    expect(s.gold).toBe(3);
    expect(takeBlock(s)).toBe('no_exit');
    expect(canTake(s)).toBe(false);
    expect(take(s)).toBeNull();
  });

  it('«Забрать» неактивна с выходом, но без первой звезды', () => {
    const s = tapAll(createState(LEVEL, 0), [[0, 3], [0, 1]]);
    expect(s.gold).toBe(1);
    expect(takeBlock(s)).toBe('no_gold');
    expect(take(s)).toBeNull();
  });

  it('«Забрать» с выходом и первой звездой — победа, звёзды по золоту', () => {
    const s = tapAll(createState(LEVEL, 0), [[0, 3], [0, 1], [1, 0], [1, 1]]);
    expect(s.gold).toBe(3);
    expect(canTake(s)).toBe(true);
    const won = take(s);
    expect(won?.status).toBe('won');
    expect(starsFor(LEVEL, won?.gold ?? 0)).toBe(2);
    expect(goldLeft(s)).toBe(3);
  });

  it('последняя безопасная плита — победа без «Забрать», на три звезды', () => {
    const safe: Array<[number, number]> = [];
    for (let r = 0; r < 4; r += 1) for (let c = 0; c < 4; c += 1) if (!['0,0', '3,3', '3,0'].includes(`${String(r)},${String(c)}`)) safe.push([r, c]);
    let s = createState(LEVEL, 0);
    for (const [r, c] of safe.slice(0, -1)) s = tapAll(s, [[r, c]]);
    expect(s.status).toBe('playing');
    const last = safe.at(-1) as [number, number];
    const res = tap(s, last[0], last[1]);
    expect(res?.cleared).toBe(true);
    expect(res?.state.status).toBe('won');
    expect(safeLeft(res?.state as GameState)).toBe(0);
    expect(starsFor(LEVEL, res?.state.gold ?? 0)).toBe(3);
  });

  it('раскладка берётся по модулю числа раскладок', () => {
    expect(createState(LEVEL, 5).layout).toBe(0);
  });

  it('звёзды: 0 ниже первого порога, дальше по порогам', () => {
    expect([0, 1, 2, 3, 4, 9].map((g) => starsFor(LEVEL, g))).toEqual([0, 0, 1, 2, 3, 3]);
  });
});
