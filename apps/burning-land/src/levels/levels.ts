import type { Level } from '../engine/types.ts';

/**
 * §6 спеки. Источник — `GAME_LEVELS` в `tools/burning-land-solver.mjs`:
 * 1–2 обучающие, 3–5 с ловушкой (обе наивные стратегии проигрывают). Руками
 * не редактируются — `tests/levels.test.ts` сверяет копию с солвером.
 */
export const LEVELS: readonly Level[] = [
  {
    id: 1,
    name: 'BL-T1',
    tutorial: true,
    rows: ['........', '........', '.H......', '........', '........', 'F.....H.', '........', '........'],
    shapes: 'SOOMTDSVIOMOVDSOOLSMOSSVDTLLDVTIVLODSOSOTVTSSOLDVSTDIIVDVSTS',
  },
  {
    id: 2,
    name: 'BL-T2',
    tutorial: true,
    rows: ['........', '......H.', '..HH....', '........', '........', '....F...', '.F......', '........'],
    shapes: 'LVILSSTTTVVTDTTTVOMIOMVSSDVMOOOLSMTVTSLDISLLTIVTLOIOTMIVMSLI',
  },
  {
    id: 3,
    name: 'BL-3-51',
    tutorial: false,
    rows: ['....F...', '.F......', '........', '..H..H..', '........', '..H.....', '........', '........'],
    shapes: 'ODTVMSISIDSOSLLLLOMTSSLVTTDVSMVSTISSDMSMSVVLODTTSSVVDIVLMVLV',
  },
  {
    id: 4,
    name: 'BL-4-17',
    tutorial: false,
    rows: ['........', '....F...', '......H.', '......H.', '..F...H.', '...F..H.', '........', '........'],
    shapes: 'VILILOIVMTOLIOLDOSSVIMIOSDDDMIMOMTIVDTDVTDDTSIDIOOODOTTILDDI',
  },
  {
    id: 5,
    name: 'BL-5-28',
    tutorial: false,
    rows: ['....HH..', '........', '.H......', '...F....', '........', '.....F.F', '........', 'H.H.....'],
    shapes: 'MOLDMLVLLTOILOLLMDLSOTLIODSOIMOOODMOIOTVLIITOOMOLVIVOLTSIOOI',
  },
];

export const LEVEL_COUNT = LEVELS.length;

export function getLevel(id: number): Level {
  const level = LEVELS[id - 1];
  if (level === undefined) throw new Error(`no level ${String(id)}`);
  return level;
}
