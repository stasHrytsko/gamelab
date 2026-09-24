import type {
  Cell,
  Direction,
  Level,
  LevelState,
  MoveOutcome,
  PassengerState,
  Pickup,
  SwipeAction,
  Taxi,
} from './types.ts';

const DELTA: Readonly<Record<Direction, Cell>> = {
  up: { row: -1, col: 0 },
  right: { row: 0, col: 1 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
};

export function targetCell(
  target: PassengerState['target'],
  gridSize = 5,
): Cell {
  switch (target.side) {
    case 'top':
      return { row: 0, col: target.index };
    case 'right':
      return { row: target.index, col: gridSize - 1 };
    case 'bottom':
      return { row: gridSize - 1, col: target.index };
    case 'left':
      return { row: target.index, col: 0 };
  }
}

function sameCell(first: Cell, second: Cell): boolean {
  return first.row === second.row && first.col === second.col;
}

function isInside(cell: Cell, gridSize: number): boolean {
  return cell.row >= 0 && cell.row < gridSize && cell.col >= 0 && cell.col < gridSize;
}

function activatePassengers(
  passengers: readonly PassengerState[],
  served: number,
): { passengers: PassengerState[]; activated: string[] } {
  const activated: string[] = [];
  const next = passengers.map((passenger): PassengerState => {
    if (passenger.status !== 'queued' || passenger.unlockAfterServed > served) return passenger;
    activated.push(passenger.id);
    return {
      ...passenger,
      patience: passenger.initialPatience,
      status: 'waiting',
    };
  });
  return { passengers: next, activated };
}

function resolveAutomaticPickups(
  taxisInput: readonly Taxi[],
  passengersInput: readonly PassengerState[],
  servedInput: number,
): {
  taxis: Taxi[];
  passengers: PassengerState[];
  served: number;
  pickups: Pickup[];
  activated: string[];
} {
  let taxis = [...taxisInput];
  let passengers = [...passengersInput];
  let served = servedInput;
  const pickups: Pickup[] = [];
  const activated: string[] = [];

  while (true) {
    const activation = activatePassengers(passengers, served);
    passengers = activation.passengers;
    activated.push(...activation.activated);

    const waiting = passengers.find((passenger) => {
      if (passenger.status !== 'waiting') return false;
      const cell = targetCell(passenger.target);
      return taxis.some((taxi) => taxi.color === passenger.color && sameCell(taxi, cell));
    });
    if (waiting === undefined) break;

    const cell = targetCell(waiting.target);
    const matchingTaxi = taxis.find(
      (taxi) => taxi.color === waiting.color && sameCell(taxi, cell),
    );
    if (matchingTaxi === undefined) break;

    taxis = taxis.filter((taxi) => taxi.id !== matchingTaxi.id);
    passengers = passengers.map((passenger) =>
      passenger.id === waiting.id ? { ...passenger, status: 'served' } : passenger,
    );
    served += 1;
    pickups.push({
      taxiId: matchingTaxi.id,
      passengerId: waiting.id,
      automatic: true,
    });
  }

  return { taxis, passengers, served, pickups, activated };
}

export function createState(level: Level): LevelState {
  const passengerStates: PassengerState[] = level.passengers.map((passenger) => ({
    ...passenger,
    patience: passenger.initialPatience,
    status: 'queued',
  }));
  const resolved = resolveAutomaticPickups(level.taxis, passengerStates, 0);
  const won = resolved.served === level.passengers.length;

  return {
    taxis: resolved.taxis,
    passengers: resolved.passengers,
    moves: 0,
    served: resolved.served,
    status: won ? 'won' : 'playing',
    failReason: null,
  };
}

export function resolveSwipe(
  level: Level,
  state: LevelState,
  action: SwipeAction,
): MoveOutcome {
  const emptyOutcome = (
    valid: boolean,
    ignored: boolean,
  ): MoveOutcome => ({
    state,
    valid,
    ignored,
    movedTaxiId: null,
    from: null,
    to: null,
    pickups: [],
    activatedPassengerIds: [],
  });

  if (state.status !== 'playing') return emptyOutcome(false, true);

  const taxi = state.taxis.find((candidate) => candidate.id === action.taxiId);
  if (taxi === undefined) return emptyOutcome(false, true);

  const delta = DELTA[action.direction];
  const destination = {
    row: taxi.row + delta.row,
    col: taxi.col + delta.col,
  };
  const occupied = state.taxis.some((candidate) => sameCell(candidate, destination));
  if (!isInside(destination, level.gridSize) || occupied) {
    return {
      ...emptyOutcome(false, false),
      movedTaxiId: taxi.id,
      from: { row: taxi.row, col: taxi.col },
      to: destination,
    };
  }

  const movedTaxi: Taxi = { ...taxi, ...destination };
  let taxis = state.taxis.map((candidate) => (candidate.id === taxi.id ? movedTaxi : candidate));
  let passengers = [...state.passengers];
  let served = state.served;
  const pickups: Pickup[] = [];

  const passenger = passengers.find(
    (candidate) =>
      candidate.status === 'waiting' &&
      candidate.color === movedTaxi.color &&
      sameCell(targetCell(candidate.target, level.gridSize), destination),
  );
  if (passenger !== undefined) {
    taxis = taxis.filter((candidate) => candidate.id !== movedTaxi.id);
    passengers = passengers.map((candidate) =>
      candidate.id === passenger.id ? { ...candidate, status: 'served' } : candidate,
    );
    served += 1;
    pickups.push({
      taxiId: movedTaxi.id,
      passengerId: passenger.id,
      automatic: false,
    });
  }

  passengers = passengers.map((candidate): PassengerState => {
    if (candidate.status !== 'waiting') return candidate;
    return { ...candidate, patience: candidate.patience - 1 };
  });

  const expired = passengers.some(
    (candidate) => candidate.status === 'waiting' && candidate.patience <= 0,
  );
  if (expired) {
    return {
      state: {
        taxis,
        passengers: passengers.map((candidate) =>
          candidate.status === 'waiting' && candidate.patience <= 0
            ? { ...candidate, status: 'left' }
            : candidate,
        ),
        moves: state.moves + 1,
        served,
        status: 'failed',
        failReason: 'passenger_timeout',
      },
      valid: true,
      ignored: false,
      movedTaxiId: taxi.id,
      from: { row: taxi.row, col: taxi.col },
      to: destination,
      pickups,
      activatedPassengerIds: [],
    };
  }

  const automatic = resolveAutomaticPickups(taxis, passengers, served);
  pickups.push(...automatic.pickups);
  // Taxis outside the passenger list are blockers: the level ends when every
  // passenger has left, whatever is still standing on the grid.
  const won = automatic.served === level.passengers.length;

  return {
    state: {
      taxis: automatic.taxis,
      passengers: automatic.passengers,
      moves: state.moves + 1,
      served: automatic.served,
      status: won ? 'won' : 'playing',
      failReason: null,
    },
    valid: true,
    ignored: false,
    movedTaxiId: taxi.id,
    from: { row: taxi.row, col: taxi.col },
    to: destination,
    pickups,
    activatedPassengerIds: automatic.activated,
  };
}
