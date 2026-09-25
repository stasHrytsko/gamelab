export interface GameEntry {
  readonly slug: string;
  readonly title: string;
  readonly pitch: string;
  /** Human-readable add date, matches data/README.md. */
  readonly added: string;
  readonly levels: number;
  readonly family: string;
  /**
   * Live Vercel URL. Empty until the prototype is deployed — the card then
   * honestly shows "Soon" instead of a dead "Play" button.
   */
  readonly url: string;
}

/** Newest first — that's the one that lands in the big featured card. */
export const GAMES: readonly GameEntry[] = [
  {
    slug: 'two-moves-later',
    title: 'Taxi Slide',
    pitch:
      'Slide colored taxis around a 5×5 grid like a sliding puzzle and reach each passenger before they leave; every completed ride opens another empty cell.',
    added: 'Sep 25',
    levels: 5,
    family: 'puzzle',
    url: '',
  },
];
