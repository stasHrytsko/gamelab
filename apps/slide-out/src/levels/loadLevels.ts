import type {
  Level,
  GoalDefinition,
  Side,
  Block,
  BlockColor,
} from '../engine/types.ts';
import rawLevelPack from './levels.json';

export const LEVELS_SCHEMA_VERSION = 1;
export const LEVEL_COUNT = 5;
const COLORS: readonly BlockColor[] = ['red', 'blue', 'yellow'];
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
    if (rawLevel['gridSize'] !== 5) throw new Error('Block Slide uses a 5x5 grid.');

    const rawBlocks = rawLevel['blocks'];
    const rawGoals = rawLevel['goals'];
    // At least two holes, or nothing on the grid can move.
    if (!Array.isArray(rawBlocks) || rawBlocks.length < 1 || rawBlocks.length > 23) {
      throw new Error('A level must contain 1 to 23 blocks.');
    }
    if (!Array.isArray(rawGoals) || rawGoals.length < 1 || rawGoals.length > rawBlocks.length) {
      throw new Error('A level needs 1 goal or more, and no more goals than blocks.');
    }
    const goalCount = rawGoals.length;

    const ids = new Set<string>();
    const cells = new Set<string>();
    const blocks: Block[] = rawBlocks.map((entry, index) => {
      const value = object(entry, `blocks[${String(index)}]`);
      const blockId = string(value['id'], 'block.id');
      const color = value['color'];
      if (!COLORS.includes(color as BlockColor)) throw new Error('Unknown block color.');
      const row = integer(value['row'], 'block.row', 0, 4);
      const col = integer(value['col'], 'block.col', 0, 4);
      const cell = `${String(row)}:${String(col)}`;
      if (ids.has(blockId) || cells.has(cell)) throw new Error('Block ids and cells must be unique.');
      ids.add(blockId);
      cells.add(cell);
      return { id: blockId, color: color as BlockColor, row, col };
    });

    const goalIds = new Set<string>();
    const goals: GoalDefinition[] = rawGoals.map((entry, index) => {
      const value = object(entry, `goals[${String(index)}]`);
      const goalId = string(value['id'], 'goal.id');
      if (goalIds.has(goalId)) throw new Error('Goal ids must be unique.');
      goalIds.add(goalId);
      const color = value['color'];
      if (!COLORS.includes(color as BlockColor)) throw new Error('Unknown goal color.');
      const rawTarget = object(value['target'], 'goal.target');
      const side = rawTarget['side'];
      if (!SIDES.includes(side as Side)) throw new Error('Unknown target side.');
      return {
        id: goalId,
        color: color as BlockColor,
        target: {
          side: side as Side,
          index: integer(rawTarget['index'], 'goal.target.index', 0, 4),
        },
        // Countdown is set per goal by the level generator: the moves its
        // known route needs plus the level's slack (tools/generate-levels.ts).
        initialCountdown: integer(value['initialCountdown'], 'goal.initialCountdown', 2, 15),
        unlockAfterServed: integer(
          value['unlockAfterServed'],
          'goal.unlockAfterServed',
          0,
          goalCount - 1,
        ),
      };
    });

    for (const color of COLORS) {
      const blockCount = blocks.filter((block) => block.color === color).length;
      const wanted = goals.filter((goal) => goal.color === color).length;
      if (blockCount < wanted) throw new Error(`Not enough ${color} blocks for the ${color} goals.`);
    }
    if (goals.filter((goal) => goal.unlockAfterServed === 0).length !== 1) {
      throw new Error('A level must start with exactly one goal.');
    }

    return { id, gridSize: 5, blocks, goals };
  });
}

export const LEVELS: readonly Level[] = parseLevelPack(rawLevelPack, LEVEL_COUNT);

export function getLevel(levelIndex: number): Level {
  const level = LEVELS[levelIndex];
  if (level === undefined) throw new Error(`No level at index ${String(levelIndex)}.`);
  return level;
}
