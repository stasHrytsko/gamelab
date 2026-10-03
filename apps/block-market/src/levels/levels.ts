/**
 * Пять базовых уровней. Level — это цель, число камней на старте и то, насколько
 * неудобны фигуры. Зерно фиксировано: «Retry» начинает с того же поля и
 * тех же трёх фигур.
 */
export interface LevelDef {
  readonly id: number;
  /** Линий нужно собрать за 20 фигур. */
  readonly goal: number;
  /** Камней (заполненных клеток) на старте. */
  readonly stones: number;
  /** Из скольких кандидатов сдаётся самая неудобная. */
  readonly hostileK: number;
  /** С какой «глубиной» набора фигур играем: чем выше, тем больше сложных пентомино. */
  readonly mix: number;
  readonly seed: number;
}

export const LEVELS: readonly LevelDef[] = [
  { id: 1, goal: 4, stones: 3, hostileK: 2, mix: 1, seed: 101 },
  { id: 2, goal: 5, stones: 5, hostileK: 3, mix: 3, seed: 202 },
  { id: 3, goal: 6, stones: 7, hostileK: 3, mix: 5, seed: 303 },
  { id: 4, goal: 7, stones: 9, hostileK: 4, mix: 8, seed: 404 },
  { id: 5, goal: 8, stones: 11, hostileK: 5, mix: 11, seed: 505 },
];

export const LEVEL_COUNT = LEVELS.length;

export const levelDef = (id: number): LevelDef | undefined => LEVELS.find((l) => l.id === id);
