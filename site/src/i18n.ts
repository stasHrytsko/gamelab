export type Lang = 'en' | 'uk';

export const LANGS: readonly Lang[] = ['en', 'uk'];

const dict = {
  en: {
    tagline: 'ideas prototypes notes',
    nav: { about: 'About', games: 'Games', blog: 'Blog', contacts: 'Contacts' },
    menu: 'Menu',
    close: 'Close',
    heroTitle: 'Ideas, prototypes|& small experiments.',
    heroLead: 'I make small game prototypes, mix mechanics, sketch things and write down what I learn.',
    heroNote: 'Small<br>Games<br>Big Joy',
    heroWhere: 'Stas / Valencia',
    heroPlay: 'Play the games',
    heroBlog: 'Read the blog',
    heroArt: 'Paper-style portrait of Stas sitting on a rock in front of paper mountains',
    gamesTitle: 'Games',
    gamesLead: 'Small playable prototypes. Tap one to play.',
    latestGame: 'Newest',
    newLabel: 'New',
    more: 'More',
    moreGames: 'All games',
    morePosts: 'All posts',
    blogTitle: 'Blog',
    blogLead: 'Progress, updates and things I learn while making small games.',
    readMore: 'Read',
    play: 'Play',
    status: { playable: 'Playable', prototype: 'Prototype', exploring: 'Exploring' },
    genre: { Puzzle: 'Puzzle', Block: 'Block', Reveal: 'Reveal', Growth: 'Growth', 'Sort-slide': 'Sort-slide', Placement: 'Placement' } as Record<string, string>,
    contactsTitle: 'Contacts',
    contactsLead: 'You can find me here.',
    soon: 'soon',
    footer: 'Stazzi — ideas, prototypes & notes.',
    backTop: 'Back to top',
    gamesPageTitle: 'Games — Stazzi',
    gamesPageDesc: 'Small playable game prototypes by Stas. Pick one and play.',
    blogPageTitle: 'Blog — Stazzi',
    blogPageDesc: 'Progress, updates and things Stas learns while making small games.',
    homeTitle: 'Stazzi — Ideas, prototypes & small experiments',
    homeDesc: 'Stas Hrytsko makes small game prototypes, mixes mechanics and writes down what he learns.',
    postsCount: (n: number) => `${n} ${n === 1 ? 'post' : 'posts'}`,
    minRead: (n: number) => `${n} min read`,
    latestPost: 'Latest post',
    readPost: 'Read the post',
    archive: 'All writing',
    filterAll: 'All',
    allPosts: 'All posts',
    nextPost: 'Next post',
    noPosts: 'No posts yet.',
    onlyEnglish: 'English only',
    articleAside: 'Written while building, testing and changing my mind.',
    postNumber: 'Post',
    switchTo: 'Українською',
    switchLabel: 'Switch language to Ukrainian',
  },
  uk: {
    tagline: 'ідеї прототипи нотатки',
    nav: { about: 'Про мене', games: 'Ігри', blog: 'Блог', contacts: 'Контакти' },
    menu: 'Меню',
    close: 'Закрити',
    heroTitle: 'Ідеї, прототипи|та малі експерименти.',
    heroLead: 'Я роблю невеликі ігрові прототипи, змішую механіки, малюю ескізи й записую, чого навчаюся.',
    heroNote: 'Малі<br>ігри,<br>велика<br>радість',
    heroWhere: 'Стас / Валенсія',
    heroPlay: 'Грати',
    heroBlog: 'Читати блог',
    heroArt: 'Паперовий портрет Стаса, який сидить на камені на тлі паперових гір',
    gamesTitle: 'Ігри',
    gamesLead: 'Невеликі прототипи, у які можна пограти. Натисніть, щоб почати.',
    latestGame: 'Найновіша',
    newLabel: 'Нова',
    more: 'Більше',
    moreGames: 'Усі ігри',
    morePosts: 'Усі пости',
    blogTitle: 'Блог',
    blogLead: 'Прогрес, оновлення й те, чого я навчаюся, роблячи малі ігри.',
    readMore: 'Читати',
    play: 'Грати',
    status: { playable: 'Можна грати', prototype: 'Прототип', exploring: 'Досліджую' },
    genre: { Puzzle: 'Головоломка', Block: 'Блоки', Reveal: 'Розкриття', Growth: 'Ріст', 'Sort-slide': 'Сортування', Placement: 'Розстановка' } as Record<string, string>,
    contactsTitle: 'Контакти',
    contactsLead: 'Мене можна знайти тут.',
    soon: 'скоро',
    footer: 'Stazzi — ідеї, прототипи й нотатки.',
    backTop: 'Нагору',
    gamesPageTitle: 'Ігри — Stazzi',
    gamesPageDesc: 'Невеликі ігрові прототипи Стаса. Обирайте й грайте.',
    blogPageTitle: 'Блог — Stazzi',
    blogPageDesc: 'Прогрес, оновлення й те, чого Стас навчається, роблячи малі ігри.',
    homeTitle: 'Stazzi — ідеї, прототипи та малі експерименти',
    homeDesc: 'Стас Гритько робить невеликі ігрові прототипи, змішує механіки й записує, чого навчається.',
    postsCount: (n: number) => {
      const last = n % 10;
      const tens = n % 100;
      const word = last === 1 && tens !== 11 ? 'пост' : last >= 2 && last <= 4 && (tens < 12 || tens > 14) ? 'пости' : 'постів';
      return `${n} ${word}`;
    },
    minRead: (n: number) => `${n} хв читання`,
    latestPost: 'Останній пост',
    readPost: 'Читати пост',
    archive: 'Усі записи',
    filterAll: 'Усі',
    allPosts: 'Усі пости',
    nextPost: 'Наступний пост',
    noPosts: 'Постів поки немає.',
    onlyEnglish: 'Лише англійською',
    articleAside: 'Написано під час створення, тестування й зміни думки.',
    postNumber: 'Пост',
    switchTo: 'English',
    switchLabel: 'Перемкнути мову на англійську',
  },
} as const;

export type Dict = (typeof dict)['en'];

export function t(lang: Lang): Dict {
  return dict[lang] as unknown as Dict;
}

export type Page = 'home' | 'games' | 'blog';

/** Адрес страницы на нужном языке: английский в корне, украинский под /uk/. */
export function pageUrl(lang: Lang, page: Page): string {
  const base = lang === 'uk' ? '/uk/' : '/';
  return page === 'home' ? base : `${base}${page}/`;
}

export function formatDate(value: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
