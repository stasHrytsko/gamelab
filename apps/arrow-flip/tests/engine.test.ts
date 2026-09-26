import { describe, expect, it } from 'vitest';
import { createState, frontNeighbor, hasAnyMove, isExitReady, isTrapFree, legalMoves, planMove, tap } from '../src/engine/flipEngine.ts';
import type { Block, Level } from '../src/engine/types.ts';

const blocks: Block[] = [
  { id: '0', row: 1, col: 2, dir: '<' },
  { id: '1', row: 3, col: 1, dir: 'v' },
  { id: '2', row: 2, col: 1, dir: '<' },
];
const level: Level = { id: 99, name: 'T', tutorial: true, moveLimit: 3, blocks };

describe('движение и повороты (§4)', () => {
  it('блок едет до края, если путь свободен', () => {
    // 0 (row1,col2,<) идёт влево через свободный ряд и уходит за край.
    const outcome = planMove(blocks, '0');
    expect(outcome?.move.exited).toBe(true);
    expect(outcome?.move.steps).toBe(2);
  });

  it('упор в соседний блок останавливает движение перед ним', () => {
    const stacked: Block[] = [{ id: 'a', row: 0, col: 0, dir: '>' }, { id: 'b', row: 0, col: 1, dir: '<' }];
    expect(planMove(stacked, 'a')).toBeNull();
  });

  it('блок у края, смотрящий наружу, уходит сразу — это допустимый ход', () => {
    const edge: Block[] = [{ id: 'a', row: 0, col: 0, dir: '^' }];
    const outcome = planMove(edge, 'a');
    expect(outcome?.move.exited).toBe(true);
    expect(outcome?.move.steps).toBe(0);
  });

  it('задетые по пути поворачиваются на 90° по часовой ровно один раз', () => {
    // m едет влево, упирается в a на (0,0) — b на (1,1) задет сбоку по дороге.
    const row: Block[] = [
      { id: 'm', row: 0, col: 3, dir: '<' },
      { id: 'a', row: 0, col: 0, dir: '^' },
      { id: 'b', row: 1, col: 1, dir: '^' },
    ];
    const outcome = planMove(row, 'm');
    expect(outcome?.move.exited).toBe(false);
    expect(outcome?.move.steps).toBe(2);
    const a = outcome?.blocks.find((b) => b.id === 'a');
    const b = outcome?.blocks.find((b) => b.id === 'b');
    expect(a?.dir).toBe('>'); // ^ -> >, задет спереди
    expect(b?.dir).toBe('>'); // задет сбоку, тоже один раз
  });

  it('движущийся блок от собственного движения не поворачивается', () => {
    // m упирается в стену из блоков и остаётся на поле — проверяем его же dir.
    const wall: Block[] = [
      { id: 'm', row: 0, col: 0, dir: '>' },
      { id: 'x', row: 0, col: 2, dir: '<' },
    ];
    const outcome = planMove(wall, 'm');
    expect(outcome?.move.exited).toBe(false);
    const mover = outcome?.blocks.find((b) => b.id === 'm');
    expect(mover?.dir).toBe('>');
  });

  it('диагональное касание не считается', () => {
    // m проезжает одну клетку и упирается в stop; d стоит по диагонали от
    // конечной клетки пути и ни разу не делит с ним грань.
    const diag: Block[] = [
      { id: 'm', row: 0, col: 0, dir: 'v' },
      { id: 'stop', row: 2, col: 0, dir: '^' },
      { id: 'd', row: 2, col: 1, dir: '^' },
    ];
    const outcome = planMove(diag, 'm');
    expect(outcome?.move.exited).toBe(false);
    expect(outcome?.move.steps).toBe(1);
    const stop = outcome?.blocks.find((b) => b.id === 'stop');
    const d = outcome?.blocks.find((b) => b.id === 'd');
    expect(stop?.dir).toBe('>'); // упёрлись прямо в него — задет
    expect(d?.dir).toBe('^'); // по диагонали от конечной клетки — не задет
  });
});

describe('допустимость хода (§4)', () => {
  it('isExitReady — верно только когда путь до края свободен', () => {
    expect(isExitReady(blocks, '1')).toBe(true);
    const blocked: Block[] = [
      { id: 'a', row: 0, col: 0, dir: '>' },
      { id: 'b', row: 0, col: 2, dir: '<' },
    ];
    expect(isExitReady(blocked, 'a')).toBe(false);
  });
  it('frontNeighbor — сосед, в которого упирается стрелка', () => {
    const stacked: Block[] = [{ id: 'a', row: 0, col: 0, dir: '>' }, { id: 'b', row: 0, col: 1, dir: '<' }];
    expect(frontNeighbor(stacked, 'a')).toBe('b');
    expect(frontNeighbor(blocks, '1')).toBeNull();
  });
});

describe('победа и поражение (§5)', () => {
  it('победа: доска пуста после хода', () => {
    let state = createState(level);
    state = tap(state, '1')?.state ?? state;
    state = tap(state, '2')?.state ?? state;
    state = tap(state, '0')?.state ?? state;
    expect(state.status).toBe('won');
  });

  it('поражение moves_exhausted: лимит исчерпан, блоки остались', () => {
    const short: Level = { ...level, moveLimit: 1 };
    let state = createState(short);
    state = tap(state, '1')?.state ?? state;
    expect(state.status).toBe('failed');
    expect(state.failReason).toBe('moves_exhausted');
  });

  it('поражение no_moves: все блоки упёрлись друг в друга', () => {
    const stuck: Block[] = [
      { id: 'a', row: 0, col: 0, dir: '>' },
      { id: 'b', row: 0, col: 1, dir: '<' },
    ];
    expect(hasAnyMove(stuck)).toBe(false);
    expect(legalMoves(stuck)).toHaveLength(0);
  });

  it('победа проверяется раньше лимита: последний ход одновременно выход и предел', () => {
    const single: Level = { id: 1, name: 'x', tutorial: true, moveLimit: 1, blocks: [{ id: 'a', row: 0, col: 0, dir: '^' }] };
    const state = createState(single);
    const result = tap(state, 'a');
    expect(result?.state.status).toBe('won');
  });
});

describe('trap-free (§6)', () => {
  it('обучающий уровень: из любого состояния уровень остаётся выигрышным', () => {
    expect(isTrapFree(blocks, level.moveLimit)).toBe(true);
  });
  it('уровень с ловушкой не trap-free', () => {
    const trap: Block[] = [
      { id: '0', row: 0, col: 2, dir: '<' },
      { id: '1', row: 1, col: 1, dir: '<' },
      { id: '2', row: 0, col: 0, dir: 'v' },
      { id: '3', row: 1, col: 0, dir: '>' },
      { id: '4', row: 0, col: 3, dir: 'v' },
    ];
    expect(isTrapFree(trap, 6)).toBe(false);
  });
});
