# notion-to-markdown-ci

A GitHub Action that converts your entire Notion workspace into Markdown files, preserving the page hierarchy as a local directory tree.

## Features

- Converts all pages in a connected Notion workspace to `.md` files
- Mirrors the Notion page tree as a directory structure
- Downloads and localizes media files (images, videos)
- Resolves internal Notion page links to relative file paths
- Optional frontmatter generation with page metadata
- Optional kramdown-compatible `<details>`/`<summary>` blocks for Notion toggles and toggleable headings
- Optional `<iframe>`/`<video>` embeds for YouTube, Vimeo, and local video blocks

## Usage

```yml
- uses: Miyoko076/notion-to-markdown-ci@master
  with:
    NOTION-TOKEN: ${{ secrets.NOTION_TOKEN }}
```

### Full example

```yml
name: Backup Notion workspace as markdown

on:
  schedule:
    - cron: '0 3 * * *'
  workflow_dispatch:

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: Miyoko076/notion-to-markdown-ci@master
        with:
          NOTION-TOKEN: ${{ secrets.NOTION_TOKEN }}
          outputDir: './docs'
          mediaDirName: 'media'
          frontmatter: 'true'
          enableDefaultFrontmatterMetadata: 'true'
          embedMedia: 'true'
          enableKramdownTogglePatch: 'true'

      - uses: actions/upload-artifact@v7
        with:
          name: docs
          path: ./docs
```

## TODO
- [ ] Improve README.md documentation
