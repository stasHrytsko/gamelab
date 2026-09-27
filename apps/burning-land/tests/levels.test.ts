import { describe, expect, it } from 'vitest';
import { GAME_LEVELS, parse, greedyFront, greedyHouse, isTrapPick, solve, tutorialPick, winningFirstMoves, winsWithoutWalls, type Move, type SolverLevel } from '../../../tools/burning-land-solver.mjs';
import { anyFits, cellOf, createState, fits, cellsAt, place, ROTATIONS_PER_LEVEL, rotateSlot, skipTurn, trayOf } from '../src/engine/fireEngine.ts';
import { LEVELS } from '../src/levels/levels.ts';
import type { GameState, Level } from '../src/engine/types.ts';

/**
 * Прогоняет линию солвера через движок игры. `null` в линии — ход, где полезных
 * постановок нет: в игре ставится первая влезающая фигура (она не трогает огонь).
 */
export function play(level: Level, line: ReadonlyArray<Move | null>): GameState {
  let s = createState(level);
  for (const move of line) {
    if (s.status !== 'playing') break;
    if (!anyFits(level, s)) {
      const r = skipTurn(level, s);
      if (r === null) throw new Error('skip refused');
      s = r.state;
      continue;
    }
    const m = move ?? firstFit(level, s);
    for (let k = 0; k < m.rot; k += 1) {
      const rotated = rotateSlot(level, s, m.slot);
      if (rotated === null) throw new Error(`${level.name}: лимит поворотов исчерпан на ${m.letter} у ${m.row},${m.col}`);
      s = rotated;
    }
    const r = place(level, s, m.slot, { row: m.row, col: m.col });
    if (r === null) throw new Error(`${level.name}: engine rejects ${m.letter} at ${String(m.row)},${String(m.col)}`);
    expect([...r.placed].sort((a, b) => a - b)).toEqual([...m.cells].sort((a, b) => a - b));
    s = r.state;
  }
  return s;
}

function firstFit(level: Level, s: GameState): Move {
  const letters = trayOf(level, s.turn);
  for (let slot = 0; slot < letters.length; slot += 1) {
    const letter = letters[slot];
    if (letter === undefined) continue;
    for (let row = 0; row < 8; row += 1) for (let col = 0; col < 8; col += 1) {
      const at = cellsAt(letter, 0, { row, col });
      if (fits(s.cells, at) && at !== null) return { letter, rot: 0, row, col, cells: at, slot };
    }
  }
  throw new Error('nothing fits');
}

const asSolver = (l: Level): SolverLevel => ({ name: l.name, rows: l.rows, shapes: l.shapes, tutorial: l.tutorial });

describe('уровни (§6)', () => {
  it('игра берёт уровни из солвера без правки', () => {
    expect(LEVELS.map(({ name, rows, shapes, tutorial }) => ({ name, rows, shapes, tutorial }))).toEqual(
      GAME_LEVELS.map(({ name, rows, shapes, tutorial }) => ({ name, rows, shapes, tutorial: tutorial === true })),
    );
  });

  it('очагов и домов по уровням как в §6', () => {
    const count = (l: Level, ch: string): number => l.rows.join('').split(ch).length - 1;
    expect(LEVELS.map((l) => count(l, 'F'))).toEqual([1, 2, 2, 3, 3]);
    expect(LEVELS.map((l) => count(l, 'H'))).toEqual([2, 3, 3, 4, 5]);
  });

  for (const level of LEVELS) {
    const lvl = asSolver(level);

    it(`${level.name}: победная линия солвера побеждает в движке игры в пределах 3 поворотов на уровень`, () => {
      const r = solve(lvl, { rotationBudget: ROTATIONS_PER_LEVEL });
      expect(r.solvable).toBe(true);
      expect(play(level, r.line ?? []).status).toBe('won');
    });

    it(`${level.name}: без стен дома горят`, () => {
      expect(winsWithoutWalls(lvl)).toBe(false);
    });

    it(`${level.name}: линии наивных стратегий дают в движке тот же исход в пределах лимита поворотов`, () => {
      for (const g of [greedyFront(lvl, { rotationBudget: ROTATIONS_PER_LEVEL }), greedyHouse(lvl, { rotationBudget: ROTATIONS_PER_LEVEL })]) {
        const s = play(level, g.log);
        expect(s.status).toBe(g.won ? 'won' : 'failed');
      }
    });
  }

  for (const level of LEVELS.filter((l) => l.tutorial)) {
    it(`${level.name}: обучающий — обе наивные стратегии проходят, выигрывает больше половины первых постановок`, () => {
      expect(tutorialPick(asSolver(level))).not.toBeNull();
    });
  }

  // Kill-критерий в форме теста (§1, §6): на уровнях с ловушкой обе наивные
  // стратегии проигрывают, победных первых постановок от 2 до трети.
  for (const level of LEVELS.filter((l) => !l.tutorial)) {
    it(`${level.name}: ловушка — «отодвигай от ближайшего дома» и «закрывай фронт» проигрывают даже с лимитом поворотов`, () => {
      const lvl = asSolver(level);
      expect(greedyHouse(lvl, { rotationBudget: ROTATIONS_PER_LEVEL }).won).toBe(false);
      expect(greedyFront(lvl, { rotationBudget: ROTATIONS_PER_LEVEL }).won).toBe(false);
      expect(isTrapPick(lvl)).not.toBeNull();
    });
  }

  it('BL-5-28: победных первых постановок в пределах лимита поворотов меньше, чем без ограничения (4 из 183, а не 9)', () => {
    const lvl = asSolver(LEVELS[4] as Level);
    expect(winningFirstMoves(lvl, 200_000, { rotationBudget: ROTATIONS_PER_LEVEL })).toEqual({ total: 183, wins: 4, unknown: 0 });
  });

  // Показ автору 2026-09-27: первый ход V f7 g7 f6 на уровне 4 — победа остаётся,
  // и укладывается в лимит 3 поворотов на весь уровень (сам этот ход поворотов не тратит).
  it('BL-4-17: после V f7 g7 f6 победа остаётся в пределах лимита поворотов', () => {
    const lvl = asSolver(LEVELS[3] as Level);
    const s = play(LEVELS[3] as Level, [{ letter: 'V', rot: 0, row: 1, col: 5, cells: [13, 14, 21], slot: 0 }]);
    expect(s.status).toBe('playing');
    const grid = parse({ ...lvl, rows: Array.from({ length: 8 }, (_, r) => s.cells.slice(r * 8, r * 8 + 8).map((k) => ({ grass: '.', wall: 'W', fire: 'F', ash: 'x', house: 'H' })[k]).join('')) });
    expect(solve(lvl, { from: grid, turn: 1, rotationBudget: ROTATIONS_PER_LEVEL }).solvable).toBe(true);
  });

  it('индексы клеток совпадают с солвером (row * 8 + col)', () => {
    expect(cellOf(13)).toEqual({ row: 1, col: 5 });
  });
});
