import { describe, expect, it } from 'vitest';
import { solve } from '../src/engine/solver.ts';
import { LEVELS } from '../src/levels/levels.ts';

describe('обучение: по одному правилу за раз', () => {
  const only = (i: number) => {
    const l = LEVELS[i]!;
    return solve({ hero: l.hero, enemies: l.enemies }, l.moveLimit)!.path.map((a) => a.mode);
  };
  it('уровень 1 — только толчок', () => expect(new Set(only(0))).toEqual(new Set(['forward'])));
  it('уровень 2 — только рывок', () => expect(new Set(only(1))).toEqual(new Set(['back'])));
  it('уровень 3 — впервые выбор на одном шаге', () => {
    const l = LEVELS[2]!;
    expect(solve({ hero: l.hero, enemies: l.enemies }, l.moveLimit)!.path.some((a) => a.choice)).toBe(true);
  });
});

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
