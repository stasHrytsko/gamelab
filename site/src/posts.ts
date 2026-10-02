// Посты блога из content/posts/*.md — общий список для главной и /blog/.
export type Post = {
  slug: string;
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

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function parsePost(path: string, source: string): Post {
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (frontmatter === null) throw new Error(`Missing frontmatter in ${path}`);

  const meta = new Map<string, string>();
  for (const line of frontmatter[1]?.split(/\r?\n/) ?? []) {
    const separator = line.indexOf(':');
    if (separator < 1) continue;
    meta.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, ''));
  }

  const slug = path.split('/').at(-1)?.replace(/\.md$/, '') ?? '';
  const body = frontmatter[2]?.trim() ?? '';
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  const required = ['title', 'date', 'tag', 'excerpt'] as const;
  required.forEach((key) => {
    if (!meta.get(key)) throw new Error(`Missing ${key} in ${path}`);
  });

  return {
    slug,
    title: meta.get('title') ?? '',
    date: meta.get('date') ?? '',
    tag: meta.get('tag') ?? '',
    excerpt: meta.get('excerpt') ?? '',
    body,
    readingTime: Math.max(1, Math.ceil(wordCount / 210)),
  };
}

export const posts = Object.entries(sourceFiles)
  .map(([path, source]) => parsePost(path, source))
  .sort((a, b) => b.date.localeCompare(a.date));

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}
