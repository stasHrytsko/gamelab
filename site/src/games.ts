export interface GameEntry {
  readonly slug: string;
  readonly title: string;
  /** One English word — the family from the game's spec. */
  readonly genre: string;
  /** pitch_en from specs/NN-slug.md. */
  readonly pitch: string;
  /** Square icon, from public/games/<slug>-icon.png (copy of apps/<slug>/public/icon-512.png). */
  readonly icon: string;
  /**
   * Self-contained playable build, from public/games/<slug>.html — a copy of
   * apps/<slug>/dist-artifact/<slug>.html (`npx tsx tools/build-artifact.ts`
   * in the app's own folder). Same artifact bundle already used to publish
   * to claude.ai, so it needs no separate hosting: fonts, styles and images
   * are inlined, the router runs in memory.
   */
  readonly play: string;
}

/** By spec number — stable order, no "newest" bias now that there's no hero slot. */
export const GAMES: readonly GameEntry[] = [
  {
    slug: 'slide-out',
    title: 'Slide Out',
    genre: 'Puzzle',
    pitch:
      'Slide colored tiles around a 5×5 grid and bring each one to the matching goal on the edge before its countdown runs out; every tile that exits opens another empty cell.',
    icon: '/games/slide-out-icon.png',
    play: '/games/slide-out.html',
  },
  {
    slug: 'sprout',
    title: 'Sprout',
    genre: 'Growth',
    pitch:
      'Grow the root from A to B. Every step costs a move, water gives moves back, and the root never re-enters a cell it has grown through.',
    icon: '/games/sprout-icon.png',
    play: '/games/sprout.html',
  },
  {
    slug: 'excavation',
    title: 'The Dig',
    genre: 'Reveal',
    pitch:
      'Dig up the tomb floor: the number on a tile is both the traps around it and the gold it pays. Leave any time after the first star, but a trap burns it all.',
    icon: '/games/excavation-icon.png',
    play: '/games/excavation.html',
  },
  {
    slug: 'arrow-flip',
    title: 'Arrow Flip',
    genre: 'Puzzle',
    pitch:
      'Tap a block and it slides where its arrow points. Every block it brushes past turns 90° clockwise, so clear the board within the move limit.',
    icon: '/games/arrow-flip-icon.png',
    play: '/games/arrow-flip.html',
  },
  {
    slug: 'build-pack',
    title: 'Build & Pack',
    genre: 'Puzzle',
    pitch:
      'Pick a number, build your own piece from that many squares and fit it onto the board; the numbers are known up front and add up to the board exactly.',
    icon: '/games/build-pack-icon.png',
    play: '/games/build-pack.html',
  },
];
