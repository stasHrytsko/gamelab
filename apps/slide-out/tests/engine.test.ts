import { describe, expect, test } from 'vitest';
import { createState, resolveSwipe } from '../src/engine/slideEngine.ts';
import type { Level } from '../src/engine/types.ts';

// Hand-made boards, so these rules stay pinned whatever the generator ships.
const twoRides: Level = {
  id: 1,
  gridSize: 5,
  blocks: [
    { id: 'red', color: 'red', row: 1, col: 0 },
    { id: 'blue', color: 'blue', row: 4, col: 3 },
    { id: 'spare', color: 'yellow', row: 2, col: 2 },
  ],
  goals: [
    { id: 'first', color: 'red', target: { side: 'top', index: 0 }, initialCountdown: 3, unlockAfterServed: 0 },
    { id: 'second', color: 'blue', target: { side: 'right', index: 4 }, initialCountdown: 3, unlockAfterServed: 1 },
  ],
};

describe('block engine', () => {
  test('starts with one waiting goal and the rest queued', () => {
    const state = createState(twoRides);
    expect(state.status).toBe('playing');
    expect(state.goals.map((goal) => goal.status)).toEqual(['waiting', 'queued']);
  });

  test('an invalid swipe changes nothing and spends no countdown', () => {
    const state = createState(twoRides);
    const outcome = resolveSwipe(twoRides, state, { type: 'swipe-block', blockId: 'red', direction: 'left' });
    expect(outcome.valid).toBe(false);
    expect(outcome.state).toBe(state);
    expect(outcome.state.goals[0]?.countdown).toBe(3);
  });

  test('a valid swipe costs every waiting goal one countdown', () => {
    const outcome = resolveSwipe(twoRides, createState(twoRides), {
      type: 'swipe-block',
      blockId: 'spare',
      direction: 'down',
    });
    expect(outcome.valid).toBe(true);
    expect(outcome.state.moves).toBe(1);
    expect(outcome.state.goals[0]?.countdown).toBe(2);
  });

  test('a matching block leaves at once and wakes the next goal', () => {
    const outcome = resolveSwipe(twoRides, createState(twoRides), {
      type: 'swipe-block',
      blockId: 'red',
      direction: 'up',
    });
    expect(outcome.state.served).toBe(1);
    expect(outcome.state.blocks.map((block) => block.id)).toEqual(['blue', 'spare']);
    expect(outcome.state.goals[1]?.status).toBe('waiting');
    expect(outcome.state.goals[1]?.countdown).toBe(3);
  });

  test('the level is won when every goal has left, spare blocks or not', () => {
    let state = createState(twoRides);
    state = resolveSwipe(twoRides, state, { type: 'swipe-block', blockId: 'red', direction: 'up' }).state;
    state = resolveSwipe(twoRides, state, { type: 'swipe-block', blockId: 'blue', direction: 'right' }).state;
    expect(state.status).toBe('won');
    expect(state.blocks.map((block) => block.id)).toEqual(['spare']);
  });

  test('a waiting goal at one leaves after an unrelated valid swipe', () => {
    const tinyLevel: Level = {
      id: 1,
      gridSize: 5,
      blocks: [
        { id: 'red', color: 'red', row: 2, col: 2 },
        { id: 'blue', color: 'blue', row: 4, col: 4 },
      ],
      goals: [
        {
          id: 'goal',
          color: 'red',
          target: { side: 'top', index: 0 },
          initialCountdown: 1,
          unlockAfterServed: 0,
        },
      ],
    };
    const outcome = resolveSwipe(tinyLevel, createState(tinyLevel), {
      type: 'swipe-block',
      blockId: 'blue',
      direction: 'left',
    });
    expect(outcome.state.status).toBe('failed');
    expect(outcome.state.failReason).toBe('goal_timeout');
  });
});
