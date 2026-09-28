declare module 'virtual:games' {
  import type { Game } from '../../tools/games.d.mts';
  const games: readonly Game[];
  export default games;
}
