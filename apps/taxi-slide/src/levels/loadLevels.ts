import type {
  Level,
  PassengerDefinition,
  Side,
  Taxi,
  TaxiColor,
} from '../engine/types.ts';
import rawLevelPack from './levels.json';

export const LEVELS_SCHEMA_VERSION = 1;
export const LEVEL_COUNT = 5;
const COLORS: readonly TaxiColor[] = ['red', 'blue', 'yellow'];
const SIDES: readonly Side[] = ['top', 'right', 'bottom', 'left'];

function object(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) throw new Error(`${where} must be an object.`);
  return value as Record<string, unknown>;
}

function integer(value: unknown, where: string, min: number, max: number): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    throw new Error(`${where} must be an integer in [${String(min)}, ${String(max)}].`);
  }
  return value as number;
}

function string(value: unknown, where: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${where} must be a string.`);
  return value;
}

export function parseLevelPack(raw: unknown, expectedLevelCount: number): Level[] {
  const pack = object(raw, 'Level pack');
  if (pack['schemaVersion'] !== LEVELS_SCHEMA_VERSION) {
    throw new Error(`Level pack schemaVersion must be ${String(LEVELS_SCHEMA_VERSION)}.`);
  }
  const entries = pack['levels'];
  if (!Array.isArray(entries) || entries.length !== expectedLevelCount) {
    throw new Error(`Level pack must contain ${String(expectedLevelCount)} level(s).`);
  }

  return entries.map((entry, levelIndex): Level => {
    const rawLevel = object(entry, `levels[${String(levelIndex)}]`);
    const id = integer(rawLevel['id'], 'level.id', 1, expectedLevelCount);
    if (id !== levelIndex + 1) throw new Error('Level ids must be sequential.');
    if (rawLevel['gridSize'] !== 5) throw new Error('Taxi Slide uses a 5x5 grid.');

    const rawTaxis = rawLevel['taxis'];
    const rawPassengers = rawLevel['passengers'];
    // At least two holes, or nothing on the grid can move.
    if (!Array.isArray(rawTaxis) || rawTaxis.length < 1 || rawTaxis.length > 23) {
      throw new Error('A level must contain 1 to 23 taxis.');
    }
    if (!Array.isArray(rawPassengers) || rawPassengers.length < 1 || rawPassengers.length > rawTaxis.length) {
      throw new Error('A level needs 1 passenger or more, and no more passengers than taxis.');
    }
    const passengerCount = rawPassengers.length;

    const ids = new Set<string>();
    const cells = new Set<string>();
    const taxis: Taxi[] = rawTaxis.map((entry, index) => {
      const value = object(entry, `taxis[${String(index)}]`);
      const taxiId = string(value['id'], 'taxi.id');
      const color = value['color'];
      if (!COLORS.includes(color as TaxiColor)) throw new Error('Unknown taxi color.');
      const row = integer(value['row'], 'taxi.row', 0, 4);
      const col = integer(value['col'], 'taxi.col', 0, 4);
      const cell = `${String(row)}:${String(col)}`;
      if (ids.has(taxiId) || cells.has(cell)) throw new Error('Taxi ids and cells must be unique.');
      ids.add(taxiId);
      cells.add(cell);
      return { id: taxiId, color: color as TaxiColor, row, col };
    });

    const passengerIds = new Set<string>();
    const passengers: PassengerDefinition[] = rawPassengers.map((entry, index) => {
      const value = object(entry, `passengers[${String(index)}]`);
      const passengerId = string(value['id'], 'passenger.id');
      if (passengerIds.has(passengerId)) throw new Error('Passenger ids must be unique.');
      passengerIds.add(passengerId);
      const color = value['color'];
      if (!COLORS.includes(color as TaxiColor)) throw new Error('Unknown passenger color.');
      const rawTarget = object(value['target'], 'passenger.target');
      const side = rawTarget['side'];
      if (!SIDES.includes(side as Side)) throw new Error('Unknown target side.');
      return {
        id: passengerId,
        color: color as TaxiColor,
        target: {
          side: side as Side,
          index: integer(rawTarget['index'], 'passenger.target.index', 0, 4),
        },
        // Patience is set per passenger by the level generator: the moves its
        // known route needs plus the level's slack (tools/generate-levels.ts).
        initialPatience: integer(value['initialPatience'], 'passenger.initialPatience', 2, 15),
        unlockAfterServed: integer(
          value['unlockAfterServed'],
          'passenger.unlockAfterServed',
          0,
          passengerCount - 1,
        ),
      };
    });

    for (const color of COLORS) {
      const taxiCount = taxis.filter((taxi) => taxi.color === color).length;
      const wanted = passengers.filter((passenger) => passenger.color === color).length;
      if (taxiCount < wanted) throw new Error(`Not enough ${color} taxis for the ${color} passengers.`);
    }
    if (passengers.filter((passenger) => passenger.unlockAfterServed === 0).length !== 1) {
      throw new Error('A level must start with exactly one passenger.');
    }

    return { id, gridSize: 5, taxis, passengers };
  });
}

export const LEVELS: readonly Level[] = parseLevelPack(rawLevelPack, LEVEL_COUNT);

export function getLevel(levelIndex: number): Level {
  const level = LEVELS[levelIndex];
  if (level === undefined) throw new Error(`No level at index ${String(levelIndex)}.`);
  return level;
}
