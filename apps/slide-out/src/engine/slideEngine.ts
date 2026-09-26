import type {
  Cell,
  Direction,
  Level,
  LevelState,
  MoveOutcome,
  GoalState,
  Match,
  SwipeAction,
  Block,
} from './types.ts';

const DELTA: Readonly<Record<Direction, Cell>> = {
  up: { row: -1, col: 0 },
  right: { row: 0, col: 1 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
};

export function targetCell(
  target: GoalState['target'],
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

function activateGoals(
  goals: readonly GoalState[],
  served: number,
): { goals: GoalState[]; activated: string[] } {
  const activated: string[] = [];
  const next = goals.map((goal): GoalState => {
    if (goal.status !== 'queued' || goal.unlockAfterServed > served) return goal;
    activated.push(goal.id);
    return {
      ...goal,
      countdown: goal.initialCountdown,
      status: 'waiting',
    };
  });
  return { goals: next, activated };
}

function resolveAutomaticMatches(
  blocksInput: readonly Block[],
  goalsInput: readonly GoalState[],
  servedInput: number,
): {
  blocks: Block[];
  goals: GoalState[];
  served: number;
  matches: Match[];
  activated: string[];
} {
  let blocks = [...blocksInput];
  let goals = [...goalsInput];
  let served = servedInput;
  const matches: Match[] = [];
  const activated: string[] = [];

  while (true) {
    const activation = activateGoals(goals, served);
    goals = activation.goals;
    activated.push(...activation.activated);

    const waiting = goals.find((goal) => {
      if (goal.status !== 'waiting') return false;
      const cell = targetCell(goal.target);
      return blocks.some((block) => block.color === goal.color && sameCell(block, cell));
    });
    if (waiting === undefined) break;

    const cell = targetCell(waiting.target);
    const matchingBlock = blocks.find(
      (block) => block.color === waiting.color && sameCell(block, cell),
    );
    if (matchingBlock === undefined) break;

    blocks = blocks.filter((block) => block.id !== matchingBlock.id);
    goals = goals.map((goal) =>
      goal.id === waiting.id ? { ...goal, status: 'served' } : goal,
    );
    served += 1;
    matches.push({
      blockId: matchingBlock.id,
      goalId: waiting.id,
      automatic: true,
    });
  }

  return { blocks, goals, served, matches, activated };
}

export function createState(level: Level): LevelState {
  const goalStates: GoalState[] = level.goals.map((goal) => ({
    ...goal,
    countdown: goal.initialCountdown,
    status: 'queued',
  }));
  const resolved = resolveAutomaticMatches(level.blocks, goalStates, 0);
  const won = resolved.served === level.goals.length;

  return {
    blocks: resolved.blocks,
    goals: resolved.goals,
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
    movedBlockId: null,
    from: null,
    to: null,
    matches: [],
    activatedGoalIds: [],
  });

  if (state.status !== 'playing') return emptyOutcome(false, true);

  const block = state.blocks.find((candidate) => candidate.id === action.blockId);
  if (block === undefined) return emptyOutcome(false, true);

  const delta = DELTA[action.direction];
  const destination = {
    row: block.row + delta.row,
    col: block.col + delta.col,
  };
  const occupied = state.blocks.some((candidate) => sameCell(candidate, destination));
  if (!isInside(destination, level.gridSize) || occupied) {
    return {
      ...emptyOutcome(false, false),
      movedBlockId: block.id,
      from: { row: block.row, col: block.col },
      to: destination,
    };
  }

  const movedBlock: Block = { ...block, ...destination };
  let blocks = state.blocks.map((candidate) => (candidate.id === block.id ? movedBlock : candidate));
  let goals = [...state.goals];
  let served = state.served;
  const matches: Match[] = [];

  const goal = goals.find(
    (candidate) =>
      candidate.status === 'waiting' &&
      candidate.color === movedBlock.color &&
      sameCell(targetCell(candidate.target, level.gridSize), destination),
  );
  if (goal !== undefined) {
    blocks = blocks.filter((candidate) => candidate.id !== movedBlock.id);
    goals = goals.map((candidate) =>
      candidate.id === goal.id ? { ...candidate, status: 'served' } : candidate,
    );
    served += 1;
    matches.push({
      blockId: movedBlock.id,
      goalId: goal.id,
      automatic: false,
    });
  }

  goals = goals.map((candidate): GoalState => {
    if (candidate.status !== 'waiting') return candidate;
    return { ...candidate, countdown: candidate.countdown - 1 };
  });

  const expired = goals.some(
    (candidate) => candidate.status === 'waiting' && candidate.countdown <= 0,
  );
  if (expired) {
    return {
      state: {
        blocks,
        goals: goals.map((candidate) =>
          candidate.status === 'waiting' && candidate.countdown <= 0
            ? { ...candidate, status: 'left' }
            : candidate,
        ),
        moves: state.moves + 1,
        served,
        status: 'failed',
        failReason: 'goal_timeout',
      },
      valid: true,
      ignored: false,
      movedBlockId: block.id,
      from: { row: block.row, col: block.col },
      to: destination,
      matches,
      activatedGoalIds: [],
    };
  }

  const automatic = resolveAutomaticMatches(blocks, goals, served);
  matches.push(...automatic.matches);
  // Blocks outside the goal list are blockers: the level ends when every
  // goal has left, whatever is still standing on the grid.
  const won = automatic.served === level.goals.length;

  return {
    state: {
      blocks: automatic.blocks,
      goals: automatic.goals,
      moves: state.moves + 1,
      served: automatic.served,
      status: won ? 'won' : 'playing',
      failReason: null,
    },
    valid: true,
    ignored: false,
    movedBlockId: block.id,
    from: { row: block.row, col: block.col },
    to: destination,
    matches,
    activatedGoalIds: automatic.activated,
  };
}
