import { describe, expect, it } from 'vitest';
import * as sim from '../../../tools/block-market-sim.mjs';
import { baseCells, colorOf, dealtForms, STONE, swapPrice, TYPES, type PieceType } from '../src/engine/catalog.ts';
import { CFG, incomeFor } from '../src/engine/config.ts';
import {
  applyPlacement, countFits, deal, fits, mirrorPiece, place, rescuable, rotatePiece, startLevel, stuck, swapPiece,
  type GameState, type Piece,
} from '../src/engine/engine.ts';
import { hash, makeRng, nextFloat } from '../src/engine/rng.ts';
import { LEVEL_COUNT, LEVELS } from '../src/levels/levels.ts';

const piece = (type: PieceType): Piece => ({ type, cells: baseCells(type), color: colorOf(type) });
const boardFrom = (rows: string[]): number[] => rows.flatMap((r) => [...r].map((ch) => (ch === '.' ? 0 : ch === '#' ? STONE : Number(ch))));
const withState = (over: Partial<GameState>): GameState => ({ ...startLevel(LEVELS[0]!, { seed: 7 }), ...over });
const empty = (): number[] => new Array<number>(64).fill(0);
// действия над первой фигурой на руке — короткие обёртки для тестов
const put = (s: GameState, x: number, y: number) => place(s, 0, x, y);
const rot = (s: GameState) => rotatePiece(s, 0);
const mir = (s: GameState) => mirrorPiece(s, 0);
const swp = (s: GameState, t: PieceType) => swapPiece(s, 0, t);

describe('связь с симулятором', () => {
  it('общие константы совпадают с tools/block-market-sim.mjs', () => {
    expect([CFG.PIECES, CFG.START_COINS, CFG.CAP, CFG.ROTATE_COST, CFG.MIRROR_COST, CFG.SWAP_ADD, CFG.HOSTILE_EVERY]).toEqual(
      [sim.CFG.PIECES, sim.CFG.START_COINS, sim.CFG.CAP, sim.CFG.ROT90, sim.CFG.FLIP, sim.CFG.SWAP_ADD, sim.CFG.HOSTILE_EVERY],
    );
    for (let n = 1; n <= 5; n += 1) expect(incomeFor(n)).toBe(sim.CFG.income(n));
  });

  it('сдача даёт те же фигуры, что симулятор, на одном зерне и поле', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      for (const level of [1, 4, 8, 12]) {
        const board = empty();
        const r = makeRng(hash(seed, 5));
        for (let i = 0; i < 10; i += 1) board[Math.floor(nextFloat(r) * 64)] = 1;
        const rows = new Uint8Array(8);
        board.forEach((v, i) => { if (v !== 0) rows[Math.floor(i / 8)]! |= 1 << (i % 8); });
        for (const hostile of [true, false]) {
          const a = deal(level, sim.CFG.hostK(level), board, makeRng(seed * 31 + level), hostile);
          const b = sim.deal(level, rows, sim.rng(seed * 31 + level), hostile);
          expect(a.type).toBe(b.type);
          expect(JSON.stringify(a.cells)).toBe(JSON.stringify(b.cells));
        }
      }
    }
  });
});

describe('пять базовых уровней', () => {
  it('их пять, цель и число камней растут, зёрна разные', () => {
    expect(LEVEL_COUNT).toBe(5);
    expect(LEVELS.map((l) => l.id)).toEqual([1, 2, 3, 4, 5]);
    for (let i = 1; i < LEVELS.length; i += 1) {
      expect(LEVELS[i]!.goal).toBeGreaterThan(LEVELS[i - 1]!.goal);
      expect(LEVELS[i]!.stones).toBeGreaterThan(LEVELS[i - 1]!.stones);
      expect(LEVELS[i]!.mix).toBeGreaterThan(LEVELS[i - 1]!.mix);
    }
    expect(new Set(LEVELS.map((l) => l.seed)).size).toBe(5);
  });

  it('уровень начинается с 5 монет, тремя фигурами и камнями по описанию', () => {
    for (const def of LEVELS) {
      const s = startLevel(def);
      expect(s.coins).toBe(5);
      expect(s.hand).toHaveLength(3);
      expect(s.board.filter((v) => v === STONE)).toHaveLength(def.stones);
      expect([s.level, s.goal, s.used, s.lines, s.status]).toEqual([def.id, def.goal, 0, 0, 'playing']);
    }
  });

  it('те же уровень и зерно дают то же поле и руку; «Переиграть» начинает с того же', () => {
    for (const def of LEVELS) expect(JSON.stringify(startLevel(def))).toBe(JSON.stringify(startLevel(def)));
    expect(JSON.stringify(startLevel(LEVELS[0]!, { seed: 1 }))).not.toBe(JSON.stringify(startLevel(LEVELS[0]!, { seed: 2 })));
  });

  it('камни никогда не образуют готовую линию', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      for (const def of LEVELS) {
        const s = startLevel(def, { seed });
        for (let i = 0; i < 8; i += 1) {
          expect(s.board.slice(i * 8, i * 8 + 8).every((v) => v !== 0)).toBe(false);
          expect(Array.from({ length: 8 }, (_, r) => s.board[r * 8 + i]).every((v) => v !== 0)).toBe(false);
        }
      }
    }
  });

  it('на руке не бывает двух одинаковых фигур', () => {
    for (let seed = 1; seed <= 150; seed += 1) {
      for (const def of LEVELS) {
        let s = startLevel(def, { seed });
        for (let i = 0; i < 12 && s.status === 'playing'; i += 1) {
          expect(new Set(s.hand.map((p) => p.type)).size).toBe(s.hand.length);
          const spot = s.hand.flatMap((cur, k) => [...Array(64).keys()].filter((c) => fits(s.board, cur.cells, c % 8, Math.floor(c / 8))).map((c) => [k, c % 8, Math.floor(c / 8)] as const))[0];
          if (spot === undefined) break;
          s = place(s, spot[0], spot[1], spot[2])!.state;
        }
      }
    }
  });

  it('цель можно переопределить для проверки (?goal=N)', () => {
    expect(startLevel(LEVELS[2]!, { goal: 1 }).goal).toBe(1);
    expect(startLevel(LEVELS[2]!, { goal: 0 }).goal).toBe(0);
  });
});

describe('постановка и линии', () => {
  it('недопустимая постановка ход не тратит', () => {
    const s = withState({ board: boardFrom(['#.......', ...Array(7).fill('........')] as string[]), hand: [piece('domino'), piece('I3'), piece('O')] });
    expect(put(s, 0, 0)).toBeNull();
    expect(put(s, 7, 0)).toBeNull(); // домино выходит за край
    expect(put(s, 0, 7)).not.toBeNull();
  });

  it('строка и столбец закрываются одновременно и платят как две линии', () => {
    const rows = ['.1111111', '1.......', '1.......', '1.......', '1.......', '1.......', '1.......', '1.......'];
    const s = withState({ board: boardFrom(rows), hand: [piece('mono'), piece('O'), piece('O')], coins: 0 });
    const out = put(s, 0, 0);
    expect(out).not.toBeNull();
    expect(out!.event).toMatchObject({ kind: 'place', lines: 2, income: 4, gained: 4 });
    expect(out!.state.coins).toBe(4);
    expect(out!.state.lines).toBe(2);
    expect(out!.state.board.every((v) => v === 0)).toBe(true);
  });

  it('доход растёт нелинейно: 1, 4, 9 монет', () => {
    expect([1, 2, 3].map(incomeFor)).toEqual([1, 4, 9]);
  });

  it('монеты сверх потолка сгорают и считаются', () => {
    const rows = ['1111111.', ...Array(7).fill('........')] as string[];
    const s = withState({ board: boardFrom(rows), hand: [piece('mono'), piece('O'), piece('O')], coins: 10, capLost: 0 });
    const out = put(s, 7, 0)!;
    expect(out.state.coins).toBe(CFG.CAP);
    expect(out.event).toMatchObject({ income: 1, gained: 0 });
    expect(out.state.capLost).toBe(1);
  });

  it('applyPlacement не трогает неполные линии', () => {
    const p = applyPlacement(empty(), baseCells('O'), 2, 3, 3);
    expect(p.cleared).toHaveLength(0);
    expect(p.board.filter((v) => v === 2)).toHaveLength(4);
  });

  it('на место поставленной фигуры встаёт новая, остальные остаются на своих местах', () => {
    const s = startLevel(LEVELS[0]!);
    const spot = [...Array(64).keys()].map((i) => [i % 8, Math.floor(i / 8)] as const).find(([x, y]) => fits(s.board, s.hand[1]!.cells, x, y))!;
    const out = place(s, 1, spot[0], spot[1])!;
    expect(out.state.hand).toHaveLength(3);
    expect(out.state.hand[0]).toBe(s.hand[0]);
    expect(out.state.hand[2]).toBe(s.hand[2]);
    expect(out.state.hand[1]).not.toBe(s.hand[1]);
    expect(out.state.used).toBe(1);
    expect(out.state.dealIdx).toBe(4);
  });

  it('любую из трёх фигур можно поставить сразу', () => {
    const s = withState({ board: empty(), hand: [piece('T'), piece('O'), piece('I4')] });
    for (const slot of [0, 1, 2]) expect(place(s, slot, 0, 0)).not.toBeNull();
    expect(place(s, 3, 0, 0)).toBeNull();
  });

  it('в конце уровня рука сокращается: всего 20 фигур', () => {
    let s = withState({ board: empty(), hand: [piece('mono'), piece('mono'), piece('mono')], used: 17, dealIdx: 20 });
    s = place(s, 0, 0, 0)!.state;
    expect(s.hand).toHaveLength(2);
    s = place(s, 0, 1, 0)!.state;
    expect(s.hand).toHaveLength(1);
    s = place(s, 0, 2, 0)!.state;
    expect(s.hand).toHaveLength(0);
    expect(s.used).toBe(20);
    expect(['won', 'lost']).toContain(s.status);
  });
});

describe('покупки: поворот, зеркало, замена', () => {
  const s0 = withState({ board: empty(), hand: [piece('L'), piece('T'), piece('O')], coins: 5 });

  it('поворот стоит 2 и вращает на 90°', () => {
    const out = rot(s0)!;
    expect(out.state.coins).toBe(3);
    expect(out.state.hand[0]!.cells).not.toEqual(s0.hand[0]!.cells);
    let s = s0;
    for (let i = 0; i < 4; i += 1) s = { ...rot({ ...s, coins: 5 })!.state, coins: 5 };
    expect(s.hand[0]!.cells).toEqual(s0.hand[0]!.cells);
  });

  it('зеркало стоит 2 и меняет L на J', () => {
    const out = mir(s0)!;
    expect(out.state.coins).toBe(3);
    expect(out.state.hand[0]!.cells).toEqual(baseCells('J'));
  });

  it('покупка действует на выбранное место и не трогает остальные', () => {
    const out = rotatePiece(s0, 1)!;
    expect(out.state.hand[0]).toBe(s0.hand[0]);
    expect(out.state.hand[2]).toBe(s0.hand[2]);
    expect(out.state.hand[1]!.cells).not.toEqual(s0.hand[1]!.cells);
    expect(rotatePiece(s0, 3)).toBeNull();
  });

  it('там, где поворот или зеркало ничего не меняют, покупка недопустима и монеты целы', () => {
    const o = { ...s0, hand: [piece('O'), piece('T'), piece('O')] };
    expect(rot(o)).toBeNull();
    expect(mir(o)).toBeNull();
    const x = { ...s0, hand: [piece('X5'), piece('T'), piece('O')] };
    expect(rot(x)).toBeNull();
    const i4 = { ...s0, hand: [piece('I4'), piece('T'), piece('O')] };
    expect(mir(i4)).toBeNull();
    expect(rot(i4)).not.toBeNull();
  });

  it('замена стоит по каталогу 5–8 и ставит фигуру в исходной ориентации', () => {
    const prices = TYPES.map(swapPrice);
    expect(Math.min(...prices)).toBe(5);
    expect(Math.max(...prices)).toBe(8);
    const out = swp({ ...s0, coins: 10 }, 'W5')!;
    expect(out.state.coins).toBe(10 - swapPrice('W5'));
    expect(out.state.hand[0]).toMatchObject({ type: 'W5', cells: baseCells('W5') });
  });

  it('замена на ту же фигуру в той же ориентации и без денег недопустима', () => {
    expect(swp({ ...s0, coins: 10 }, 'L')).toBeNull();
    expect(swp({ ...s0, coins: 4 }, 'domino')).toBeNull();
    expect(swp({ ...s0, coins: 10 }, 'domino')).not.toBeNull();
  });

  it('без денег ни одна покупка не проходит', () => {
    const poor = { ...s0, coins: 1 };
    expect(rot(poor)).toBeNull();
    expect(mir(poor)).toBeNull();
    expect(swp(poor, 'domino')).toBeNull();
  });
});

describe('сгорание фигуры', () => {
  // всё занято, кроме одиночных дыр по диагонали: T, O и I3 не влезают никуда, влезла бы только точка
  const holes = (): number[] => {
    const board = new Array<number>(64).fill(1);
    for (const [y, x] of [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 2]] as const) board[y * 8 + x] = 0;
    return board;
  };
  const three = (): Piece[] => [piece('T'), piece('O'), piece('I3')];

  it('rescuable: дыру под точку можно получить заменой, если хватает монет на неё (7)', () => {
    expect(rescuable(holes(), three(), 6)).toBe(false);
    expect(rescuable(holes(), three(), 7)).toBe(true);
  });

  it('rescuable: поворот спасает, когда фигура встаёт только другой стороной', () => {
    // свободна только вертикальная полоска 1×3 у левого края; I3 выдана горизонтально
    const board = new Array<number>(64).fill(1);
    for (const y of [0, 1, 2]) board[y * 8] = 0;
    const hand = [piece('I3'), piece('O'), piece('O')];
    expect(rescuable(board, hand, 1)).toBe(false);
    expect(rescuable(board, hand, 2)).toBe(true);
  });

  it('если ни одной не встать и ничто не поможет, одна сгорает бесплатно и занимает ход', () => {
    const s = withState({ board: holes(), hand: three(), coins: 2, used: 3 });
    expect(stuck(s)).toBe(true);
    const out = rot(s)!; // платим последние 2 монеты: кошелёк 0, ничего уже не спасти
    expect(out.state.coins).toBe(0);
    expect(out.event.kind === 'buy' && out.event.burned.length).toBeGreaterThanOrEqual(1);
    expect(out.state.used).toBeGreaterThanOrEqual(4);
  });

  it('пока покупка может помочь, ничего не сгорает, даже когда некуда встать', () => {
    const s = withState({ board: holes(), hand: three(), coins: 9, used: 3 });
    const out = rot(s)!; // осталось 7: хватает на замену на точку
    expect(out.state.coins).toBe(7);
    expect(out.event.kind === 'buy' && out.event.burned).toHaveLength(0);
    expect(out.state.used).toBe(3);
    expect(stuck(out.state)).toBe(true);
  });

  it('если хотя бы одна фигура встаёт, ничего не сгорает даже без монет', () => {
    const s = withState({ board: holes(), hand: [piece('T'), piece('mono'), piece('O')], coins: 0, used: 3 });
    expect(stuck(s)).toBe(false);
    const out = place(s, 1, 2, 1)!;
    expect(out.event.kind).toBe('place');
    expect(out.state.used).toBe(4);
  });
});

describe('конец уровня', () => {
  const last = (over: Partial<GameState>): GameState => withState({ board: empty(), hand: [piece('mono')], used: 19, dealIdx: 20, ...over });

  it('20-я фигура и цель набрана — уровень пройден', () => {
    const out = put(last({ lines: 4, goal: 4, coins: 3 }), 0, 0)!;
    expect(out.state.status).toBe('won');
    expect(out.state.coins).toBe(3);
  });

  it('20-я фигура и цели нет — поражение', () => {
    expect(put(last({ lines: 3, goal: 4 }), 0, 0)!.state.status).toBe('lost');
  });

  it('линии, собранные последней фигурой, засчитываются', () => {
    const rows = ['.1111111', ...Array(7).fill('........')] as string[];
    expect(put(last({ board: boardFrom(rows), lines: 3, goal: 4 }), 0, 0)!.state.status).toBe('won');
  });

  it('после конца уровня ходить нельзя', () => {
    const won = put(last({ lines: 4, goal: 4 }), 0, 0)!.state;
    expect(place(won, 0, 3, 3)).toBeNull();
    expect(rotatePiece(won, 0)).toBeNull();
  });

  it('цель 0 проходится всегда', () => {
    expect(put(last({ lines: 0, goal: 0 }), 0, 0)!.state.status).toBe('won');
  });
});

describe('сдача', () => {
  it('неудобные фигуры в среднем хуже ложатся, чем случайные', () => {
    const board = startLevel(LEVELS[4]!, { seed: 9 }).board;
    const r1 = makeRng(1), r2 = makeRng(1);
    let hostile = 0, plain = 0;
    for (let i = 0; i < 400; i += 1) {
      hostile += countFits(board, deal(8, 5, board, r1, true).cells);
      plain += countFits(board, deal(8, 5, board, r2, false).cells);
    }
    expect(hostile).toBeLessThan(plain * 0.85);
  });

  it('на глубоких уровнях сложных фигур больше', () => {
    const share = (mix: number): number => {
      const r = makeRng(3);
      const hard = new Set<PieceType>(['T5', 'U5', 'Y5', 'N5', 'W5', 'X5', 'F5', 'Z5']);
      let n = 0;
      for (let i = 0; i < 2000; i += 1) if (hard.has(deal(mix, 1, empty(), r, false).type)) n += 1;
      return n / 2000;
    };
    expect(share(LEVELS[4]!.mix)).toBeGreaterThan(share(LEVELS[0]!.mix) + 0.15);
  });

  it('у каждой фигуры от 1 до 8 различимых ориентаций', () => {
    for (const t of TYPES) {
      const n = dealtForms(t).length;
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(8);
    }
    expect(dealtForms('X5')).toHaveLength(1);
    expect(dealtForms('L')).toHaveLength(8);
  });
});

describe('инварианты на случайных партиях', () => {
  it('кошелёк в границах, фигур ровно 20, баланс монет сходится, тупика без выхода нет', () => {
    for (let seed = 1; seed <= 120; seed += 1) {
      for (const def of LEVELS) {
        const pick = makeRng(seed * 7 + def.id);
        let s = startLevel(def, { seed });
        let income = 0, spent = 0;
        for (let guard = 0; guard < 400 && s.status === 'playing'; guard += 1) {
          // если ходить нечем, игра обязана была сжечь фигуру
          if (stuck(s)) expect(rescuable(s.board, s.hand, s.coins)).toBe(true);
          const slot = Math.floor(nextFloat(pick) * s.hand.length);
          const u = nextFloat(pick);
          let out = null;
          if (u < 0.12) out = rotatePiece(s, slot);
          else if (u < 0.18) out = mirrorPiece(s, slot);
          else if (u < 0.21) out = swapPiece(s, slot, TYPES[Math.floor(nextFloat(pick) * TYPES.length)]!);
          if (out === null) {
            const spots: [number, number, number][] = [];
            s.hand.forEach((cur, k) => {
              for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) if (fits(s.board, cur.cells, x, y)) spots.push([k, x, y]);
            });
            if (spots.length === 0) {
              out = rotatePiece(s, 0) ?? mirrorPiece(s, 0) ?? swapPiece(s, 0, 'mono') ?? swapPiece(s, 0, 'domino');
              if (out === null) {
                // спасение может быть на другом месте руки
                for (let k = 1; k < s.hand.length && out === null; k += 1) out = rotatePiece(s, k) ?? mirrorPiece(s, k);
              }
              if (out === null) break;
            } else {
              const [k, x, y] = spots[Math.floor(nextFloat(pick) * spots.length)]!;
              out = place(s, k, x, y);
            }
          }
          if (out === null) break;
          s = out.state;
          if (out.event.kind === 'buy') spent += out.event.cost;
          else income += out.event.gained;
          expect(s.coins).toBeGreaterThanOrEqual(0);
          expect(s.coins).toBeLessThanOrEqual(CFG.CAP);
          expect(s.used).toBeLessThanOrEqual(CFG.PIECES);
          expect(s.hand).toHaveLength(Math.min(3, CFG.PIECES - s.used));
        }
        expect(CFG.START_COINS + income - spent).toBe(s.coins);
        if (s.status !== 'playing') expect(s.used).toBe(CFG.PIECES);
      }
    }
  });
});
