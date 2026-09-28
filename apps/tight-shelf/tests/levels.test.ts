import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as solver from '../../../tools/tight-shelf-solver.mjs';
import { createState, fits, tapCell } from '../src/engine/shelfEngine.ts';
import type { GameState, Rule } from '../src/engine/types.ts';
import { LEVELS } from '../src/levels/levels.ts';

describe('уровни (§6)', () => {
  it('копия в игре совпадает с tools/tight-shelf-levels.json', () => {
    const source: unknown = JSON.parse(readFileSync(new URL('../../../tools/tight-shelf-levels.json', import.meta.url), 'utf8'));
    expect(LEVELS).toEqual(source);
  });

  it('пять уровней, поле 4×4, очередь растёт', () => {
    expect(LEVELS.map((l) => l.id)).toEqual([1, 2, 3, 4, 5]);
    for (const l of LEVELS) expect(l.rules.map((r) => r.length)).toEqual([4, 4, 4, 4]);
    for (let i = 1; i < LEVELS.length; i += 1) expect(LEVELS[i]?.queue.length).toBeGreaterThan(LEVELS[i - 1]?.queue.length ?? 0);
  });

  for (const level of LEVELS) {
    it(`уровень ${String(level.id)}: каждая фигура очереди подходит хотя бы одной клетке`, () => {
      const rules = level.rules.join('').split('') as Rule[];
      for (const piece of level.queue) expect(rules.some((r) => fits(r, piece))).toBe(true);
    });

    it(`уровень ${String(level.id)}: решение солвера проходится движком игры`, () => {
      const cells = solver.solution(level);
      expect(cells).not.toBeNull();
      let state: GameState = createState(level);
      for (const cell of cells ?? []) {
        const out = tapCell(state, cell);
        expect(out).not.toBeNull();
        state = (out as { state: GameState }).state;
      }
      expect(state.status).toBe('won');
    });
  }

  it('уровни 1–2 жадный бот проходит', () => {
    for (const l of LEVELS.filter((x) => x.id <= 2)) expect(solver.playBot(l, 'greedy').won).toBe(true);
  });

  // Kill-критерий дизайна в форме теста: «собери линию сейчас» не проходит уровни 3–5.
  it('уровни 3–5 жадный бот не проходит', () => {
    for (const l of LEVELS.filter((x) => x.id >= 3)) expect(solver.playBot(l, 'greedy').won, `уровень ${String(l.id)}`).toBe(false);
  });

  it('уровень N+1 не легче уровня N для случайного бота', () => {
    const rates = LEVELS.map((l) => solver.winRate(l, 'random', 600));
    for (let i = 1; i < rates.length; i += 1) expect(rates[i]).toBeLessThanOrEqual((rates[i - 1] ?? 1) + 0.02);
  });
});
