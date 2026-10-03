# Writing a new Stazzi blog post

Create one Markdown file per language in `site/content/posts/`:

- `my-post.en.md` for English;
- `my-post.uk.md` for Ukrainian (optional; without it the Ukrainian site shows
  the English post with an "English only" label).

The part before `.en`/`.uk` is the shareable URL fragment (`/blog/#my-post`),
so use lowercase words separated by hyphens and keep it the same in both files.

```md
---
title: A clear title
date: 2026-10-01
tag: Process
excerpt: One short sentence shown on the blog index.
---

Opening paragraph.

## Section heading

More writing here.
```

Supported formatting: `##` and `###` headings, paragraphs, `-` lists,
`>` quotes, **bold text**, inline `code`, and links. Posts are sorted by date,
newest first. No index or TypeScript file needs to be edited.
