import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { LEVEL_COUNT, LEVELS, parseLevelPack } from '../src/levels/loadLevels.ts';
import { casualWinRate } from '../tools/bot.ts';
import { replay, solveLevel, type SolutionMove } from '../tools/solver.ts';

const SOLUTIONS = (
  JSON.parse(readFileSync(new URL('../tools/solutions.json', import.meta.url), 'utf8')) as {
    level: number;
    moves: SolutionMove[];
  }[]
).map((entry) => entry.moves);

/** Группы появления пассажиров из спеки §6, по unlockAfterServed. */
function arrivalGroups(unlock: readonly number[]): number[] {
  const groups = new Map<number, number>();
  for (const at of unlock) groups.set(at, (groups.get(at) ?? 0) + 1);
  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([, size]) => size);
}

describe('пакет уровней', () => {
  test('пять уровней: 3, 4, 5, 7, 8 пассажиров', () => {
    expect(LEVEL_COUNT).toBe(5);
    expect(LEVELS.map((level) => level.passengers.length)).toEqual([3, 4, 5, 7, 8]);
  });

  test('пассажиры приходят группами как в спеке: 1→1→1, 1→1→2, 1→2→2, 1→2→2→2, 1→2→2→3', () => {
    expect(LEVELS.map((level) => arrivalGroups(level.passengers.map((p) => p.unlockAfterServed)))).toEqual([
      [1, 1, 1],
      [1, 1, 2],
      [1, 2, 2],
      [1, 2, 2, 2],
      [1, 2, 2, 3],
    ]);
  });

  test.each(LEVELS.map((level) => [level.id, level] as const))('уровень %i: маршрут солвера выигрывает на настоящем движке', (id, level) => {
    const moves = SOLUTIONS[id - 1];
    expect(moves).toBeDefined();
    expect(replay(level, moves ?? []).final.status).toBe('won');
  });

  test.each(LEVELS.slice(1).map((level) => [level.id, level] as const))(
    'уровень %i не проходится, если двигать только цвета ждущих пассажиров (kill-критерий)',
    (_id, level) => {
      const direct = solveLevel(level, { targetColorsOnly: true, branches: Number.POSITIVE_INFINITY });
      expect(direct.complete).toBe(true);
      expect(direct.solution).toBeNull();
    },
  );

  test('бот выигрывает ранние уровни заметно чаще поздних', () => {
    const rates = LEVELS.map((level) => casualWinRate(level, 60));
    expect(rates[0]).toBeGreaterThanOrEqual(0.8);
    expect(rates[0]).toBeGreaterThan(rates[2] ?? 1);
    expect(rates[2]).toBeGreaterThan(rates[4] ?? 1);
    expect(rates[4]).toBeLessThanOrEqual(0.2);
  });

  test('пакет с неверным числом уровней не загружается', () => {
    expect(() => parseLevelPack({ schemaVersion: 1, levels: [] }, 5)).toThrow('must contain 5 level');
  });
});
