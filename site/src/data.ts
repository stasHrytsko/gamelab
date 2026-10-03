import games from 'virtual:games';
import type { Game } from '../../tools/games.d.mts';
import type { Lang } from './i18n.ts';

/** Новые игры первыми: сначала по дате, при равной дате — по номеру идеи. */
export const newestGames: readonly Game[] = [...games].sort(
  (a, b) => b.added.localeCompare(a.added) || b.idea - a.idea,
);

export type Post = {
  slug: string;
  lang: Lang;
  /** true — украинской версии нет, показан английский текст. */
  fallback: boolean;
  title: string;
  date: string;
  tag: string;
  excerpt: string;
  body: string;
  readingTime: number;
};

const sourceFiles = import.meta.glob('../content/posts/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function parsePost(path: string, source: string): Post {
  const name = path.split('/').at(-1) ?? '';
  const named = name.match(/^(.+)\.(en|uk)\.md$/);
  if (named === null) throw new Error(`Post file must be <slug>.en.md or <slug>.uk.md: ${path}`);
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (frontmatter === null) throw new Error(`Missing frontmatter in ${path}`);

  const meta = new Map<string, string>();
  for (const line of frontmatter[1]?.split(/\r?\n/) ?? []) {
    const separator = line.indexOf(':');
    if (separator < 1) continue;
    meta.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, ''));
  }
  for (const key of ['title', 'date', 'tag', 'excerpt'] as const) {
    if (!meta.get(key)) throw new Error(`Missing ${key} in ${path}`);
  }
  const body = frontmatter[2]?.trim() ?? '';
  const words = body.split(/\s+/).filter(Boolean).length;
  return {
    slug: named[1] ?? '',
    lang: (named[2] ?? 'en') as Lang,
    fallback: false,
    title: meta.get('title') ?? '',
    date: meta.get('date') ?? '',
    tag: meta.get('tag') ?? '',
    excerpt: meta.get('excerpt') ?? '',
    body,
    readingTime: Math.max(1, Math.ceil(words / 210)),
  };
}

const parsed = Object.entries(sourceFiles).map(([path, source]) => parsePost(path, source));

/** Посты на языке страницы, новые первыми. Нет перевода — английская версия с пометкой. */
export function postsFor(lang: Lang): Post[] {
  const slugs = [...new Set(parsed.map((p) => p.slug))];
  const list: Post[] = [];
  for (const slug of slugs) {
    const own = parsed.find((p) => p.slug === slug && p.lang === lang);
    const en = parsed.find((p) => p.slug === slug && p.lang === 'en');
    if (own !== undefined) list.push(own);
    else if (en !== undefined) list.push({ ...en, fallback: true });
  }
  return list.sort((a, b) => b.date.localeCompare(a.date));
}
