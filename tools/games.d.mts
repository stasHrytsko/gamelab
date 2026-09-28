export interface Game {
  readonly slug: string;
  readonly idea: number;
  readonly path: string;
  readonly title: string;
  readonly genre: string;
  readonly pitch: string;
}

export const REPO: string;
export function readGames(): Game[];
