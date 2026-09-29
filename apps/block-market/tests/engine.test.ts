import { describe, expect, it } from 'vitest';
import * as sim from '../../../tools/block-market-sim.mjs';
import { baseCells, colorOf, dealtForms, STONE, swapPrice, TYPES, type PieceType } from '../src/engine/catalog.ts';
import { blockersFor, CFG, goalFor, hostileK, incomeFor } from '../src/engine/config.ts';
import {
  applyPlacement, countFits, deal, fits, mirrorCurrent, nextLevel, place, rerollCurrent, rotateCurrent, startRun,
  swapCurrent, type GameState, type Piece,
} from '../src/engine/engine.ts';
import { hash, makeRng, nextFloat } from '../src/engine/rng.ts';

const piece = (type: PieceType): Piece => ({ type, cells: baseCells(type), color: colorOf(type) });
const boardFrom = (rows: string[]): number[] => rows.flatMap((r) => [...r].map((ch) => (ch === '.' ? 0 : ch === '#' ? STONE : Number(ch))));
const withState = (over: Partial<GameState>): GameState => ({ ...startRun(7), ...over });
const empty = (): number[] => new Array<number>(64).fill(0);

describe('константы: те же, что в симуляторе', () => {
  it('совпадают с tools/block-market-sim.mjs', () => {
    expect([CFG.PIECES, CFG.START_COINS, CFG.CAP, CFG.LEVEL_BONUS, CFG.MAX_LEVELS]).toEqual(
      [sim.CFG.PIECES, sim.CFG.START_COINS, sim.CFG.CAP, sim.CFG.LEVEL_BONUS, sim.CFG.MAX_LEVELS],
    );
    expect([CFG.ROTATE_COST, CFG.MIRROR_COST, CFG.REROLL_COST, CFG.SWAP_ADD, CFG.HOSTILE_EVERY]).toEqual(
      [sim.CFG.ROT90, sim.CFG.FLIP, sim.CFG.REROLL, sim.CFG.SWAP_ADD, sim.CFG.HOSTILE_EVERY],
    );
    for (let level = 1; level <= 12; level += 1) {
      expect(goalFor(level)).toBe(sim.CFG.goal(level));
      expect(blockersFor(level)).toBe(sim.CFG.blockers(level));
      expect(hostileK(level)).toBe(sim.CFG.hostK(level));
    }
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
          const a = deal(level, board, makeRng(seed * 31 + level), hostile);
          const b = sim.deal(level, rows, sim.rng(seed * 31 + level), hostile);
          expect(a.type).toBe(b.type);
          expect(JSON.stringify(a.cells)).toBe(JSON.stringify(b.cells));
        }
      }
    }
  });
});

describe('начало забега', () => {
  it('5 монет, очередь из трёх, камни на поле, цель 5', () => {
    const s = startRun(1);
    expect(s.coins).toBe(5);
    expect(s.queue).toHaveLength(3);
    expect(s.board.filter((v) => v === STONE)).toHaveLength(blockersFor(1));
    expect([s.level, s.goal, s.used, s.lines, s.status]).toEqual([1, 5, 0, 0, 'playing']);
  });

  it('камни никогда не образуют готовую линию', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      for (const level of [1, 6, 12]) {
        const s = startRun(seed, { level });
        for (let i = 0; i < 8; i += 1) {
          expect(s.board.slice(i * 8, i * 8 + 8).every((v) => v !== 0)).toBe(false);
          expect(Array.from({ length: 8 }, (_, r) => s.board[r * 8 + i]).every((v) => v !== 0)).toBe(false);
        }
      }
    }
  });

  it('те же зерно и уровень дают то же поле и очередь', () => {
    expect(JSON.stringify(startRun(42))).toBe(JSON.stringify(startRun(42)));
    expect(JSON.stringify(startRun(42))).not.toBe(JSON.stringify(startRun(43)));
  });

  it('?level=N стартует с N-го уровня и целью по кривой', () => {
    expect(startRun(1, { level: 7 }).goal).toBe(goalFor(7));
    expect(startRun(1, { goal: 2 }).goal).toBe(2);
  });
});

describe('постановка и линии', () => {
  it('недопустимая постановка ход не тратит', () => {
    const s = withState({ board: boardFrom(['#.......', ...Array(7).fill('........')] as string[]), queue: [piece('domino'), piece('I3'), piece('O')] });
    expect(place(s, 0, 0)).toBeNull();
    expect(place(s, 7, 0)).toBeNull(); // домино выходит за край
    expect(place(s, 0, 7)).not.toBeNull();
  });

  it('строка и столбец закрываются одновременно и платят как две линии', () => {
    const rows = ['.1111111', '1.......', '1.......', '1.......', '1.......', '1.......', '1.......', '1.......'];
    const s = withState({ board: boardFrom(rows), queue: [piece('mono'), piece('O'), piece('O')], coins: 0 });
    const out = place(s, 0, 0);
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
    const s = withState({ board: boardFrom(rows), queue: [piece('mono'), piece('O'), piece('O')], coins: 10, capLost: 0 });
    const out = place(s, 7, 0)!;
    expect(out.state.coins).toBe(CFG.CAP);
    expect(out.event).toMatchObject({ income: 1, gained: 0 });
    expect(out.state.capLost).toBe(1);
  });

  it('applyPlacement не трогает неполные линии', () => {
    const p = applyPlacement(empty(), baseCells('O'), 2, 3, 3);
    expect(p.cleared).toHaveLength(0);
    expect(p.board.filter((v) => v === 2)).toHaveLength(4);
  });

  it('очередь сдвигается, следующая фигура становится текущей', () => {
    const s = startRun(3);
    const spot = [...Array(64).keys()].map((i) => [i % 8, Math.floor(i / 8)] as const).find(([x, y]) => fits(s.board, s.queue[0]!.cells, x, y))!;
    const out = place(s, spot[0], spot[1])!;
    expect(out.state.queue[0]).toBe(s.queue[1]);
    expect(out.state.queue[1]).toBe(s.queue[2]);
    expect(out.state.used).toBe(1);
  });
});

describe('покупки', () => {
  const s0 = withState({ board: empty(), queue: [piece('L'), piece('T'), piece('O')], coins: 5 });

  it('поворот стоит 2 и вращает на 90°', () => {
    const out = rotateCurrent(s0)!;
    expect(out.state.coins).toBe(3);
    expect(out.state.queue[0]!.cells).not.toEqual(s0.queue[0]!.cells);
    let s = s0;
    for (let i = 0; i < 4; i += 1) s = { ...rotateCurrent({ ...s, coins: 5 })!.state, coins: 5 };
    expect(s.queue[0]!.cells).toEqual(s0.queue[0]!.cells);
  });

  it('зеркало стоит 2 и меняет L на J', () => {
    const out = mirrorCurrent(s0)!;
    expect(out.state.coins).toBe(3);
    expect(out.state.queue[0]!.cells).toEqual(baseCells('J'));
  });

  it('там, где поворот или зеркало ничего не меняют, покупка недопустима и монеты целы', () => {
    const o = { ...s0, queue: [piece('O'), piece('T'), piece('O')] };
    expect(rotateCurrent(o)).toBeNull();
    expect(mirrorCurrent(o)).toBeNull();
    const x = { ...s0, queue: [piece('X5'), piece('T'), piece('O')] };
    expect(rotateCurrent(x)).toBeNull();
    const i4 = { ...s0, queue: [piece('I4'), piece('T'), piece('O')] };
    expect(mirrorCurrent(i4)).toBeNull();
    expect(rotateCurrent(i4)).not.toBeNull();
  });

  it('замена стоит по каталогу 5–8 и ставит фигуру в исходной ориентации', () => {
    const prices = TYPES.map(swapPrice);
    expect(Math.min(...prices)).toBe(5);
    expect(Math.max(...prices)).toBe(8);
    const out = swapCurrent({ ...s0, coins: 10 }, 'W5')!;
    expect(out.state.coins).toBe(10 - swapPrice('W5'));
    expect(out.state.queue[0]).toMatchObject({ type: 'W5', cells: baseCells('W5') });
  });

  it('замена на ту же фигуру в той же ориентации и без денег недопустима', () => {
    expect(swapCurrent({ ...s0, coins: 10 }, 'L')).toBeNull();
    expect(swapCurrent({ ...s0, coins: 4 }, 'domino')).toBeNull();
    expect(swapCurrent({ ...s0, coins: 10 }, 'domino')).not.toBeNull();
  });

  it('пересдача стоит 2, даёт другую фигуру и идёт детерминированно', () => {
    const out = rerollCurrent(s0)!;
    expect(out.state.coins).toBe(3);
    const again = rerollCurrent(s0)!;
    expect(again.state.queue[0]).toEqual(out.state.queue[0]);
    const second = rerollCurrent({ ...out.state, coins: 5 })!;
    expect(second.state.rerollRng.a).not.toBe(out.state.rerollRng.a);
  });

  it('без денег ни одна покупка не проходит', () => {
    const poor = { ...s0, coins: 1 };
    expect(rotateCurrent(poor)).toBeNull();
    expect(mirrorCurrent(poor)).toBeNull();
    expect(rerollCurrent(poor)).toBeNull();
    expect(swapCurrent(poor, 'domino')).toBeNull();
  });
});

describe('сгорание фигуры', () => {
  // всё занято, кроме одиночных дыр по диагонали и (0,0), (0,1): моно в (0,0) закроет только столбец 0,
  // а O и T в полосу шириной 1 и в одиночные дыры не влезут
  const almostFull = (): number[] => {
    const board = new Array<number>(64).fill(1);
    for (const [y, x] of [[0, 0], [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 2]] as const) board[y * 8 + x] = 0;
    return board;
  };

  it('фигура без места и кошелёк меньше 2: сгорает бесплатно и занимает ход', () => {
    const s = withState({ board: almostFull(), queue: [piece('mono'), piece('O'), piece('T')], coins: 0, used: 3 });
    const out = place(s, 0, 0)!;
    expect(out.event.kind === 'place' && out.event.burned.map((p) => p.type)).toContain('O');
    expect(out.state.used).toBeGreaterThanOrEqual(3 + 1 + 1);
    expect(out.state.coins).toBe(1);
  });

  it('с 2+ монетами фигура не сгорает сама: игрок может заплатить', () => {
    const s = withState({ board: almostFull(), queue: [piece('mono'), piece('O'), piece('T')], coins: 5, used: 3 });
    const out = place(s, 0, 0)!;
    expect(out.event.kind === 'place' && out.event.burned).toHaveLength(0);
    expect(out.state.queue[0]!.type).toBe('O');
    expect(countFits(out.state.board, out.state.queue[0]!.cells)).toBe(0);
  });
});

describe('конец уровня и забега', () => {
  const last = (over: Partial<GameState>): GameState => withState({ board: empty(), queue: [piece('mono'), piece('O'), piece('O')], used: 19, ...over });

  it('20-я фигура и цель набрана — уровень пройден, +1 монета', () => {
    const out = place(last({ lines: 5, goal: 5, coins: 3 }), 0, 0)!;
    expect(out.state.status).toBe('level_won');
    expect(out.state.coins).toBe(4);
    expect(out.state.levelsCleared).toBe(1);
  });

  it('20-я фигура и цели нет — поражение', () => {
    const out = place(last({ lines: 4, goal: 5 }), 0, 0)!;
    expect(out.state.status).toBe('lost');
  });

  it('линии, собранные последней фигурой, засчитываются', () => {
    const rows = ['.1111111', ...Array(7).fill('........')] as string[];
    const out = place(last({ board: boardFrom(rows), lines: 4, goal: 5 }), 0, 0)!;
    expect(out.state.status).toBe('level_won');
  });

  it('после победы нельзя ходить, следующий уровень переносит кошелёк', () => {
    const won = place(last({ lines: 5, goal: 5, coins: 6 }), 0, 0)!.state;
    expect(place(won, 3, 3)).toBeNull();
    expect(rotateCurrent(won)).toBeNull();
    const next = nextLevel({ ...won, goalOverride: null })!;
    expect([next.level, next.coins, next.used, next.lines, next.status]).toEqual([2, 7, 0, 0, 'playing']);
    expect(next.goal).toBe(goalFor(2));
    expect(nextLevel(startRun(1))).toBeNull();
  });

  it('12-й уровень пройден — забег пройден', () => {
    const out = place(last({ level: 12, lines: 9, goal: 9 }), 0, 0)!;
    expect(out.state.status).toBe('run_won');
  });

  it('бонус за уровень тоже упирается в потолок', () => {
    const out = place(last({ lines: 5, goal: 5, coins: 10, capLost: 0 }), 0, 0)!;
    expect(out.state.coins).toBe(10);
    expect(out.state.capLost).toBe(1);
  });
});

describe('сдача', () => {
  it('неудобные фигуры в среднем хуже ложатся, чем случайные', () => {
    const board = startRun(9, { level: 8 }).board;
    const r1 = makeRng(1), r2 = makeRng(1);
    let hostile = 0, plain = 0;
    for (let i = 0; i < 400; i += 1) {
      hostile += countFits(board, deal(8, board, r1, true).cells);
      plain += countFits(board, deal(8, board, r2, false).cells);
    }
    expect(hostile).toBeLessThan(plain * 0.85);
  });

  it('на глубине сложных фигур больше', () => {
    const share = (level: number): number => {
      const r = makeRng(3);
      const hard = new Set<PieceType>(['T5', 'U5', 'Y5', 'N5', 'W5', 'X5', 'F5', 'Z5']);
      let n = 0;
      for (let i = 0; i < 2000; i += 1) if (hard.has(deal(level, empty(), r, false).type)) n += 1;
      return n / 2000;
    };
    expect(share(10)).toBeGreaterThan(share(1) + 0.15);
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
  it('кошелёк в границах, фигур ровно 20, баланс монет сходится', () => {
    for (let seed = 1; seed <= 150; seed += 1) {
      const pick = makeRng(seed * 7);
      let s = startRun(seed);
      let income = 0, spent = 0, bonus = 0;
      let guard = 0;
      while ((s.status === 'playing' || s.status === 'level_won') && guard < 2000) {
        guard += 1;
        if (s.status === 'level_won') {
          const n = nextLevel(s)!;
          bonus += 0; // бонус учтён при победе
          s = n;
          continue;
        }
        const before = s;
        const u = nextFloat(pick);
        let out = null;
        if (u < 0.12) out = rotateCurrent(s);
        else if (u < 0.18) out = mirrorCurrent(s);
        else if (u < 0.22) out = rerollCurrent(s);
        else if (u < 0.25) out = swapCurrent(s, TYPES[Math.floor(nextFloat(pick) * TYPES.length)]!);
        if (out === null) {
          const cur = s.queue[0]!;
          const spots: [number, number][] = [];
          for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) if (fits(s.board, cur.cells, x, y)) spots.push([x, y]);
          if (spots.length === 0) { out = rerollCurrent(s) ?? rotateCurrent(s) ?? mirrorCurrent(s); if (out === null) break; } else {
            const [x, y] = spots[Math.floor(nextFloat(pick) * spots.length)]!;
            out = place(s, x, y);
          }
        }
        if (out === null) break;
        s = out.state;
        if (out.event.kind === 'buy') spent += out.event.cost;
        else income += out.event.gained;
        if (before.status === 'playing' && s.status === 'level_won') bonus += Math.min(CFG.LEVEL_BONUS, CFG.CAP - (out.event.kind === 'place' ? before.coins + out.event.gained : before.coins - out.event.cost));
        expect(s.coins).toBeGreaterThanOrEqual(0);
        expect(s.coins).toBeLessThanOrEqual(CFG.CAP);
        expect(s.used).toBeLessThanOrEqual(CFG.PIECES);
      }
      expect(CFG.START_COINS + income + bonus - spent).toBe(s.coins);
      if (s.status === 'lost' || s.status === 'run_won') expect(s.used).toBe(CFG.PIECES);
    }
  });
});
