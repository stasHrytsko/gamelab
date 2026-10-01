import { describe, expect, it } from 'vitest';
import { solve } from '../src/engine/solver.ts';
import { LEVELS } from '../src/levels/levels.ts';

describe('уровни', () => {
  for (const level of LEVELS) {
    const start = { hero: level.hero, enemies: level.enemies };
    const best = solve(start, level.moveLimit);

    it(`${level.name}: решается в лимит`, () => {
      expect(best).not.toBeNull();
    });

    if (level.tutorial) {
      it(`${level.name}: обучающий — лимит с запасом, жадный выбор решает`, () => {
        expect(level.moveLimit).toBeGreaterThanOrEqual((best?.length ?? 99) + 2);
        expect(solve(start, level.moveLimit, true)).not.toBeNull();
      });
    } else {
      it(`${level.name}: ловушка — лимит равен оптимуму, жадная стратегия не решает`, () => {
        expect(level.moveLimit).toBe(best?.length);
        expect(solve(start, level.moveLimit, true)).toBeNull();
      });
      it(`${level.name}: в решении есть настоящий выбор вперёд/назад`, () => {
        expect(best?.path.some((a) => a.choice)).toBe(true);
      });
    }
  }
});
