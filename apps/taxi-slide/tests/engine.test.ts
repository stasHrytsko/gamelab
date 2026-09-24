import { describe, expect, test } from 'vitest';
import { createState, resolveSwipe } from '../src/engine/taxiEngine.ts';
import type { Level } from '../src/engine/types.ts';

// Hand-made boards, so these rules stay pinned whatever the generator ships.
const twoRides: Level = {
  id: 1,
  gridSize: 5,
  taxis: [
    { id: 'red', color: 'red', row: 1, col: 0 },
    { id: 'blue', color: 'blue', row: 4, col: 3 },
    { id: 'spare', color: 'yellow', row: 2, col: 2 },
  ],
  passengers: [
    { id: 'first', color: 'red', target: { side: 'top', index: 0 }, initialPatience: 3, unlockAfterServed: 0 },
    { id: 'second', color: 'blue', target: { side: 'right', index: 4 }, initialPatience: 3, unlockAfterServed: 1 },
  ],
};

describe('taxi engine', () => {
  test('starts with one waiting passenger and the rest queued', () => {
    const state = createState(twoRides);
    expect(state.status).toBe('playing');
    expect(state.passengers.map((passenger) => passenger.status)).toEqual(['waiting', 'queued']);
  });

  test('an invalid swipe changes nothing and spends no patience', () => {
    const state = createState(twoRides);
    const outcome = resolveSwipe(twoRides, state, { type: 'swipe-taxi', taxiId: 'red', direction: 'left' });
    expect(outcome.valid).toBe(false);
    expect(outcome.state).toBe(state);
    expect(outcome.state.passengers[0]?.patience).toBe(3);
  });

  test('a valid swipe costs every waiting passenger one patience', () => {
    const outcome = resolveSwipe(twoRides, createState(twoRides), {
      type: 'swipe-taxi',
      taxiId: 'spare',
      direction: 'down',
    });
    expect(outcome.valid).toBe(true);
    expect(outcome.state.moves).toBe(1);
    expect(outcome.state.passengers[0]?.patience).toBe(2);
  });

  test('a matching taxi leaves at once and wakes the next passenger', () => {
    const outcome = resolveSwipe(twoRides, createState(twoRides), {
      type: 'swipe-taxi',
      taxiId: 'red',
      direction: 'up',
    });
    expect(outcome.state.served).toBe(1);
    expect(outcome.state.taxis.map((taxi) => taxi.id)).toEqual(['blue', 'spare']);
    expect(outcome.state.passengers[1]?.status).toBe('waiting');
    expect(outcome.state.passengers[1]?.patience).toBe(3);
  });

  test('the level is won when every passenger has left, spare taxis or not', () => {
    let state = createState(twoRides);
    state = resolveSwipe(twoRides, state, { type: 'swipe-taxi', taxiId: 'red', direction: 'up' }).state;
    state = resolveSwipe(twoRides, state, { type: 'swipe-taxi', taxiId: 'blue', direction: 'right' }).state;
    expect(state.status).toBe('won');
    expect(state.taxis.map((taxi) => taxi.id)).toEqual(['spare']);
  });

  test('a waiting passenger at one leaves after an unrelated valid swipe', () => {
    const tinyLevel: Level = {
      id: 1,
      gridSize: 5,
      taxis: [
        { id: 'red', color: 'red', row: 2, col: 2 },
        { id: 'blue', color: 'blue', row: 4, col: 4 },
      ],
      passengers: [
        {
          id: 'passenger',
          color: 'red',
          target: { side: 'top', index: 0 },
          initialPatience: 1,
          unlockAfterServed: 0,
        },
      ],
    };
    const outcome = resolveSwipe(tinyLevel, createState(tinyLevel), {
      type: 'swipe-taxi',
      taxiId: 'blue',
      direction: 'left',
    });
    expect(outcome.state.status).toBe('failed');
    expect(outcome.state.failReason).toBe('passenger_timeout');
  });
});
