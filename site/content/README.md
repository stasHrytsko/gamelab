# Writing a new Stazzi note

Create one Markdown file in `site/content/posts/`. The file name becomes the
shareable URL fragment, so use lowercase words separated by hyphens.

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
