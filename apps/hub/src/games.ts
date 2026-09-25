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
    title: 'Taxi Slide',
    date: 'Sep 25',
    genre: 'Puzzle',
    pitch:
      'Slide colored taxis around a 5×5 grid like a sliding puzzle and reach each passenger before they leave; every completed ride opens another empty cell.',
    banner: '/games/taxi-slide-banner.jpg',
    url: '',
  },
];
