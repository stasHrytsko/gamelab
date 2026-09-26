import { describe, expect, it } from 'vitest';
import { greedySolves, isExitReady, isTrapFree, legalMoves, solve } from '../src/engine/flipEngine.ts';
import { LEVELS } from '../src/levels/levels.ts';

describe('уровни (§6)', () => {
  for (const level of LEVELS) {
    it(`${level.name}: оптимум солвера равен лимиту`, () => {
      const solution = solve(level.blocks, level.moveLimit);
      expect(solution).not.toBeNull();
      expect(solution).toHaveLength(level.moveLimit);
    });
  }

  for (const level of LEVELS.filter((l) => l.tutorial)) {
    it(`${level.name}: обучающий — trap-free и решается жадно`, () => {
      expect(isTrapFree(level.blocks, level.moveLimit)).toBe(true);
      expect(greedySolves(level.blocks, level.moveLimit)).toBe(true);
    });
    it(`${level.name}: хотя бы один первый ход кого-то поворачивает`, () => {
      expect(legalMoves(level.blocks).some((o) => o.move.touches.length > 0)).toBe(true);
    });
  }

  // Kill-критерий в форме теста (§1, §8): на уровнях с ловушкой жадная
  // стратегия «запускай только то, что уже может выйти» не решает уровень.
  for (const level of LEVELS.filter((l) => !l.tutorial)) {
    it(`${level.name}: ловушка — жадная стратегия не решает уровень`, () => {
      expect(greedySolves(level.blocks, level.moveLimit)).toBe(false);
    });
    it(`${level.name}: на старте есть блок, готовый к выходу (приманка)`, () => {
      expect(level.blocks.some((b) => isExitReady(level.blocks, b.id))).toBe(true);
    });
    it(`${level.name}: не trap-free — тупик реален (§5)`, () => {
      expect(isTrapFree(level.blocks, level.moveLimit)).toBe(false);
    });
  }
});
