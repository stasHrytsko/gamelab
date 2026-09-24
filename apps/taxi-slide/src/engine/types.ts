export type TaxiColor = 'red' | 'blue' | 'yellow';
export type Direction = 'up' | 'right' | 'down' | 'left';
export type Side = 'top' | 'right' | 'bottom' | 'left';

export interface Cell {
  readonly row: number;
  readonly col: number;
}

export interface Taxi extends Cell {
  readonly id: string;
  readonly color: TaxiColor;
}

export interface PassengerDefinition {
  readonly id: string;
  readonly color: TaxiColor;
  readonly target: {
    readonly side: Side;
    readonly index: number;
  };
  readonly initialPatience: number;
  readonly unlockAfterServed: number;
}

export interface Level {
  readonly id: number;
  readonly gridSize: 5;
  readonly taxis: readonly Taxi[];
  readonly passengers: readonly PassengerDefinition[];
}

export interface PassengerState extends PassengerDefinition {
  readonly patience: number;
  readonly status: 'queued' | 'waiting' | 'served' | 'left';
}

export interface LevelState {
  readonly taxis: readonly Taxi[];
  readonly passengers: readonly PassengerState[];
  readonly moves: number;
  readonly served: number;
  readonly status: 'playing' | 'won' | 'failed';
  readonly failReason: 'passenger_timeout' | null;
}

export interface SwipeAction {
  readonly type: 'swipe-taxi';
  readonly taxiId: string;
  readonly direction: Direction;
}

export interface Pickup {
  readonly taxiId: string;
  readonly passengerId: string;
  readonly automatic: boolean;
}

export interface MoveOutcome {
  readonly state: LevelState;
  readonly valid: boolean;
  readonly ignored: boolean;
  readonly movedTaxiId: string | null;
  readonly from: Cell | null;
  readonly to: Cell | null;
  readonly pickups: readonly Pickup[];
  readonly activatedPassengerIds: readonly string[];
}
