import { describe, expect, it } from 'vitest';
import { GAME_LEVELS, everySourceNeeded, firstChoices, greedy, isTrapPick, minStart, parse, solve } from '../../../tools/sprout-solver.mjs';
import { createState, step } from '../src/engine/sproutEngine.ts';
import { LEVELS } from '../src/levels/levels.ts';
import { SIZE } from '../src/engine/types.ts';
import type { GameState, Level } from '../src/engine/types.ts';

/** Прогоняет путь солвера (индексы клеток, первый — А) через движок игры. */
function play(level: Level, path: readonly number[]): GameState {
  let s = createState(level);
  for (const i of path.slice(1)) {
    const r = step(level, s, { row: Math.floor(i / SIZE), col: i % SIZE });
    if (r === null) throw new Error(`${level.name}: engine rejects step ${String(i)}`);
    s = r.state;
  }
  return s;
}

describe('уровни (§6)', () => {
  it('игра берёт уровни из солвера без правки', () => {
    expect(LEVELS.map(({ name, start, rows, tutorial }) => ({ name, start, rows, tutorial }))).toEqual(
      GAME_LEVELS.map(({ name, start, rows, tutorial }) => ({ name, start, rows, tutorial: tutorial === true })),
    );
  });

  it('воды по уровням: 1, 2, 4, 5, 6', () => {
    expect(LEVELS.map((l) => parse(l).water.length)).toEqual([1, 2, 4, 5, 6]);
  });

  for (const level of LEVELS) {
    const g = parse(level);
    const result = solve(g, { orders: true });

    it(`${level.name}: каждый победный путь солвера побеждает в движке игры`, () => {
      expect(result.solvable).toBe(true);
      for (const path of result.orders.values()) expect(play(level, path).status).toBe('won');
    });

    it(`${level.name}: каждая вода необходима, любая победа выпивает всю воду`, () => {
      expect(everySourceNeeded(g)).toBe(true);
      for (const key of result.orders.keys()) expect(key.split(',')).toHaveLength(g.water.length);
    });

    it(`${level.name}: путь жадной стратегии в движке игры даёт тот же исход`, () => {
      const gr = greedy(g);
      const s = play(level, gr.state.path);
      if (gr.won) expect(s.status).toBe('won');
      else expect(s.status).not.toBe('won');
    });
  }

  for (const level of LEVELS.filter((l) => l.tutorial)) {
    const g = parse(level);
    it(`${level.name}: обучающий — запас с люфтом ≥ 2, жадная стратегия проходит`, () => {
      expect(level.start - (minStart(g) ?? Infinity)).toBeGreaterThanOrEqual(2);
      expect(greedy(g).won).toBe(true);
      expect(firstChoices(g)).toHaveLength(g.water.length);
    });
  }

  it('SP-T2: побеждают оба порядка воды', () => {
    expect(solve(parse(LEVELS[1] as Level), { orders: true }).orders.size).toBe(2);
  });

  // Kill-критерий в форме теста (§1, §6): на уровнях с ловушкой «иди к
  // ближайшей воде» проигрывает, ближайшая вода — приманка.
  for (const level of LEVELS.filter((l) => !l.tutorial)) {
    const g = parse(level);
    it(`${level.name}: запас без люфта, два первых выбора, ловушка`, () => {
      expect(minStart(g)).toBe(level.start);
      expect(firstChoices(g).length).toBeGreaterThanOrEqual(2);
      expect(greedy(g).won).toBe(false);
      expect(isTrapPick(level)).toBe(true);
    });
  }
});
