export interface Game {
  readonly slug: string;
  readonly idea: number;
  readonly path: string;
  readonly title: string;
  readonly genre: string;
  readonly pitch: string;
  readonly pitchUk: string;
  /** Короткая строка для карточек (до ~60 знаков). */
  readonly tagline: string;
  readonly taglineUk: string;
  /** Дата появления игры, ГГГГ-ММ-ДД: по ней витрина находит «самую новую». */
  readonly added: string;
  readonly status: 'playable' | 'prototype' | 'exploring';
}

export const REPO: string;
export function readGames(): Game[];
