import { describe, expect, it } from 'vitest';
import { createState, legalSteps, modesOf, move, stepInfo } from '../src/engine/forwardEngine.ts';
import { solve } from '../src/engine/solver.ts';
import type { Dir, GameState, Level } from '../src/engine/types.ts';
import { LEVELS } from '../src/levels/levels.ts';

const mk = (hero: [number, number], enemies: [number, number][], moveLimit = 9): GameState =>
  createState({
    id: 0,
    name: 't',
    tutorial: false,
    moveLimit,
    hero: { row: hero[0], col: hero[1] },
    enemies: enemies.map(([row, col], i) => ({ id: String(i), row, col })),
  } satisfies Level);

describe('правила: вперёд / назад', () => {
  it('вперёд берёт подряд стоящих врагов за клеткой, куда пришёл', () => {
    const s = mk([2, 0], [[2, 2], [2, 3], [2, 4]]);
    const r = move(s, '>', 'forward');
    expect(r?.move.captured).toEqual(['0', '1', '2']);
    expect(r?.state.status).toBe('won');
  });

  it('назад берёт подряд стоящих врагов за клеткой, которую покинул', () => {
    const s = mk([2, 2], [[2, 1], [2, 0], [0, 0]]);
    const r = move(s, '>', 'back');
    expect(r?.move.captured).toEqual(['0', '1']);
    expect(r?.state.enemies.map((e) => e.id)).toEqual(['2']);
  });

  it('линия обрывается на пустой клетке', () => {
    const s = mk([2, 0], [[2, 2], [2, 4]]);
    expect(move(s, '>', 'forward')?.move.captured).toEqual(['0']);
  });

  it('есть и вперёд, и назад — выбирать надо, режим none недопустим', () => {
    const s = mk([2, 2], [[2, 1], [2, 4]]);
    const info = stepInfo(s, '>');
    expect(info && modesOf(info)).toEqual(['forward', 'back']);
    expect(move(s, '>', 'none')).toBeNull();
    expect(move(s, '>', 'forward')?.move.captured).toEqual(['1']);
    expect(move(s, '>', 'back')?.move.captured).toEqual(['0']);
  });

  it('если брать нечего, это обычный шаг, и он тратит ход', () => {
    const s = mk([2, 2], [[0, 0]]);
    const r = move(s, '>', 'none');
    expect(r?.state.moves).toBe(1);
    expect(r?.state.enemies).toHaveLength(1);
    expect(move(s, '>', 'forward')).toBeNull();
  });

  it('нельзя ходить на врага или за край', () => {
    const s = mk([0, 0], [[0, 1]]);
    expect(move(s, '>', 'none')).toBeNull();
    expect(move(s, '^', 'none')).toBeNull();
    expect(move(s, '<', 'none')).toBeNull();
    expect(legalSteps(s).map((x) => x.dir)).toEqual(['v']);
  });

  it('лимит ходов: на последнем ходу без победы — проигрыш', () => {
    const s = mk([2, 2], [[0, 0]], 1);
    const r = move(s, '>', 'none');
    expect(r?.state.status).toBe('failed');
    expect(r?.state.failReason).toBe('moves_exhausted');
    expect(move(r!.state, '<', 'none')).toBeNull();
  });

  it('победа на последнем ходу — победа, а не проигрыш', () => {
    const s = mk([2, 0], [[2, 2]], 1);
    expect(move(s, '>', 'forward')?.state.status).toBe('won');
  });

  it('герой, зажатый врагами и краем, — no_moves', () => {
    // Герой в углу (0,0): справа и снизу враги. После хода в (0,1) он берёт вперёд (0,2)
    // и остаётся с одним выходом; здесь проверяем прямое зажатие.
    const s = mk([0, 0], [[0, 1], [1, 0], [3, 3]], 9);
    expect(legalSteps(s)).toHaveLength(0);
  });

  it('решения солвера проходят через движок и побеждают на каждом уровне', () => {
    for (const level of LEVELS) {
      const best = solve({ hero: level.hero, enemies: level.enemies }, level.moveLimit);
      expect(best).not.toBeNull();
      let state = createState(level);
      for (const action of best?.path ?? []) {
        const r = move(state, action.dir as Dir, action.mode);
        expect(r).not.toBeNull();
        state = r!.state;
      }
      expect(state.status).toBe('won');
      expect(state.moves).toBe(best?.length);
    }
  });
});
