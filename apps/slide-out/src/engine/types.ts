export type BlockColor = 'red' | 'blue' | 'yellow';
export type Direction = 'up' | 'right' | 'down' | 'left';
export type Side = 'top' | 'right' | 'bottom' | 'left';

export interface Cell {
  readonly row: number;
  readonly col: number;
}

export interface Block extends Cell {
  readonly id: string;
  readonly color: BlockColor;
}

export interface GoalDefinition {
  readonly id: string;
  readonly color: BlockColor;
  readonly target: {
    readonly side: Side;
    readonly index: number;
  };
  readonly initialCountdown: number;
  readonly unlockAfterServed: number;
}

export interface Level {
  readonly id: number;
  readonly gridSize: 5;
  readonly blocks: readonly Block[];
  readonly goals: readonly GoalDefinition[];
}

export interface GoalState extends GoalDefinition {
  readonly countdown: number;
  readonly status: 'queued' | 'waiting' | 'served' | 'left';
}

export interface LevelState {
  readonly blocks: readonly Block[];
  readonly goals: readonly GoalState[];
  readonly moves: number;
  readonly served: number;
  readonly status: 'playing' | 'won' | 'failed';
  readonly failReason: 'goal_timeout' | null;
}

export interface SwipeAction {
  readonly type: 'swipe-block';
  readonly blockId: string;
  readonly direction: Direction;
}

export interface Match {
  readonly blockId: string;
  readonly goalId: string;
  readonly automatic: boolean;
}

export interface MoveOutcome {
  readonly state: LevelState;
  readonly valid: boolean;
  readonly ignored: boolean;
  readonly movedBlockId: string | null;
  readonly from: Cell | null;
  readonly to: Cell | null;
  readonly matches: readonly Match[];
  readonly activatedGoalIds: readonly string[];
}
