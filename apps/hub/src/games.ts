export interface GameEntry {
  readonly slug: string;
  readonly title: string;
  readonly pitch: string;
  /** Человеко-читаемая дата добавления, как в data/README.md. */
  readonly added: string;
  readonly levels: number;
  readonly family: string;
  /**
   * Боевая ссылка на Vercel. Пусто, пока прототип не задеплоен — тогда
   * карточка честно показывает «Скоро» вместо нерабочей кнопки «Играть».
   */
  readonly url: string;
  /** Цвета для декоративной обложки-тайлов карточки. */
  readonly cover: readonly ('red' | 'blue' | 'yellow')[];
}

/** Самый новый — первым; так он и попадает в большую плашку наверху. */
export const GAMES: readonly GameEntry[] = [
  {
    slug: 'two-moves-later',
    title: 'Такси-пятнашки',
    pitch:
      'Сдвигай цветные такси на поле 5×5 как пятнашки и подавай нужный цвет к пассажиру, пока он не ушёл; каждая поездка освобождает новую клетку.',
    added: '25 сент.',
    levels: 5,
    family: 'головоломка',
    url: '',
    cover: ['red', 'blue', 'yellow'],
  },
];
