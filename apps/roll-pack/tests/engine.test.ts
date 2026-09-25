import { describe, expect, it } from 'vitest';
import { createState, isValidPosition, place, validPositions } from '../src/engine/rollEngine.ts';
import type { Dice, GameState } from '../src/engine/types.ts';
import { getLevel } from '../src/levels/levels.ts';

/** Случайность по списку: каждое число — значение кубика 1..6. */
function dice(...values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length] ?? 1;
    i += 1;
    return (v - 1) / 6 + 0.01;
  };
}

const state = (heights: number[], d: Dice, cap = 3): GameState => ({
  level: 2, cap, heights, rollsMade: 1, dice: d, planksPlaced: 0, status: 'playing',
});

describe('валидная позиция (§3)', () => {
  it('ровный участок нужной ширины', () => {
    expect(isValidPosition([0, 0, 0, 1, 1, 1], 3, 3, 0)).toBe(true);
    expect(isValidPosition([0, 0, 0, 1, 1, 1], 3, 3, 3)).toBe(true);
  });
  it('ступенька под планкой — нельзя', () => {
    expect(isValidPosition([0, 0, 0, 1, 1, 1], 3, 3, 1)).toBe(false);
  });
  it('за краем поля — нельзя', () => {
    expect(isValidPosition([0, 0, 0, 0, 0, 0], 3, 3, 4)).toBe(false);
    expect(isValidPosition([0, 0, 0, 0, 0, 0], 3, 1, -1)).toBe(false);
  });
  it('выше силуэта — нельзя', () => {
    expect(isValidPosition([3, 3, 0, 0, 0, 0], 3, 2, 0)).toBe(false);
  });
  it('все позиции длины', () => {
    expect(validPositions([1, 1, 0, 0, 0, 2], 3, 2)).toEqual([0, 2, 3]);
    expect(validPositions([1, 1, 0, 0, 0, 2], 3, 4)).toEqual([]);
  });
});

describe('укладка и броски (§4–5)', () => {
  it('первый бросок — три числа, попытка идёт', () => {
    const s = createState(getLevel(1), dice(2, 5, 6));
    expect(s.dice).toEqual([2, 5, 6]);
    expect(s.heights).toEqual([0, 0, 0, 0, 0, 0]);
    expect(s.status).toBe('playing');
  });

  it('планка поднимает свои столбцы на 1 и приходит новый бросок', () => {
    const out = place(state([0, 0, 0, 0, 0, 0], [3, 1, 6]), 0, 2, dice(4, 4, 2));
    expect(out.valid).toBe(true);
    expect(out.state.heights).toEqual([0, 0, 1, 1, 1, 0]);
    expect(out.state.dice).toEqual([4, 4, 2]);
    expect(out.state.rollsMade).toBe(2);
    expect(out.state.planksPlaced).toBe(1);
  });

  it('невалидная позиция ничего не меняет и не тратит бросок', () => {
    const before = state([0, 1, 0, 0, 0, 0], [3, 3, 3]);
    const out = place(before, 0, 0, dice(1));
    expect(out.valid).toBe(false);
    expect(out.state).toBe(before);
  });

  it('закрытый ряд отмечается', () => {
    const out = place(state([1, 1, 1, 0, 0, 0], [3, 1, 1]), 0, 3, dice(1, 1, 1));
    expect(out.valid && out.completedRows).toEqual([0]);
  });

  it('победа: поле заполнено, новый бросок не делается', () => {
    const out = place(state([2, 2, 2, 3, 3, 3], [3, 1, 1]), 0, 0, dice(6));
    expect(out.state.status).toBe('won');
    expect(out.state.rollsMade).toBe(1);
  });

  it('поражение no_fit: ни одна из трёх длин никуда не ложится', () => {
    // После хода ровный участок шириной 5 — тройка ложится.
    const out = place(state([0, 0, 0, 1, 1, 2], [3, 1, 1]), 0, 0, dice(3, 4, 5));
    expect(out.state.heights).toEqual([1, 1, 1, 1, 1, 2]);
    expect(out.state.status).toBe('playing');
    const lost = place(state([0, 1, 1, 2, 2, 3], [1, 1, 1], 4), 0, 0, dice(4, 5, 6));
    expect(lost.state.heights).toEqual([1, 1, 1, 2, 2, 3]);
    expect(lost.state.status).toBe('failed');
  });

  it('после конца попытки ходить нельзя', () => {
    const done: GameState = { ...state([1, 1, 1, 1, 1, 1], [1, 1, 1]), status: 'failed' };
    expect(place(done, 0, 0, dice(1)).valid).toBe(false);
  });

  it('одинаковые кубики допустимы', () => {
    const out = place(state([0, 0, 0, 0, 0, 0], [2, 2, 2]), 1, 4, dice(1));
    expect(out.state.heights).toEqual([0, 0, 0, 0, 1, 1]);
  });
});
