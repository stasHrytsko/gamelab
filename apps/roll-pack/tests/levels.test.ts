import { describe, expect, it } from 'vitest';
import { countSolutions, emptyCount, parseMap, snakeSolves, solve } from '../src/engine/packEngine.ts';
import { LEVELS } from '../src/levels/levels.ts';

describe('уровни (§6)', () => {
  for (const level of LEVELS) {
    it(`уровень ${String(level.id)}: числа 4–7, по убыванию, сумма = пустым клеткам, есть решение`, () => {
      const board = parseMap(level.map);
      expect(level.numbers.every((n) => n >= 4 && n <= 7)).toBe(true);
      expect([...level.numbers].sort((a, b) => b - a)).toEqual(level.numbers);
      expect(level.numbers.reduce((a, b) => a + b, 0)).toBe(emptyCount(board));
      expect(solve(board, level.numbers)).not.toBeNull();
    });
  }

  // Kill-критерий в форме теста: заполнение рядами не проходит уровни 2–5.
  for (const level of LEVELS.filter((l) => l.id >= 2)) {
    it(`уровень ${String(level.id)}: «змейка» не решает`, () => {
      expect(snakeSolves(parseMap(level.map), level.numbers)).toBe(false);
    });
  }

  it('решений всё меньше от уровня 2 к уровню 5', () => {
    const counts = LEVELS.filter((l) => l.id >= 2).map((l) => countSolutions(parseMap(l.map), l.numbers, 2000));
    console.log('решений (до 2000):', counts.join(' → '));
    for (let i = 1; i < counts.length; i += 1) expect(counts[i]).toBeLessThanOrEqual(counts[i - 1] ?? 0);
    expect(counts[counts.length - 1]).toBeLessThanOrEqual(10);
  });
});
