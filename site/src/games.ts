export interface GameEntry {
  readonly slug: string;
  readonly title: string;
  readonly date: string;
  readonly genre: string;
  readonly pitch: string;
  /** Wide hero art, from public/games/<slug>-banner.jpg. */
  readonly banner: string;
  /**
   * Live Vercel URL. Empty until the prototype is deployed — the card then
   * honestly shows "Soon" instead of a dead "Play" button.
   */
  readonly url: string;
}

/** Newest first — that's the one that lands in the big hero card. */
export const GAMES: readonly GameEntry[] = [
  {
    slug: 'two-moves-later',
    title: 'Slide Out',
    date: 'Sep 25',
    genre: 'Puzzle',
    pitch:
      'Slide colored tiles around a 5×5 grid and bring each one to the matching goal on the edge before its countdown runs out; every tile that exits opens another empty cell.',
    banner: '/games/slide-out-banner.jpg',
    url: '',
  },
];
