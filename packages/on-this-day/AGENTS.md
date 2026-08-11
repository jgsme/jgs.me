# Package: on-this-day

This document provides context for the `on-this-day` package.

## Overview

This package is a Cloudflare Worker (`w-on-this-day`) that processes "On This Day" data. It scans Scrapbox pages with titles in `MMDD` format (e.g., `0105`) and extracts historical event entries (links under `[YYYY]` headings).

### Key Technologies

- **Runtime:** [Cloudflare Workers](https://workers.cloudflare.com/)
- **Orchestration:** [Cloudflare Workflows](https://developers.cloudflare.com/workers/runtime-apis/workflows/)
- **Database:** Cloudflare D1 (via `@jigsaw/db`)
- **Storage:** Cloudflare R2 (reading raw page JSON)
- **Parser:** `@progfay/scrapbox-parser`

### Architecture

The worker uses a single workflow:

| Workflow            | Description                                                                                                                                                             |
| :------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OnThisDayWorkflow` | Fetches recently updated `MMDD` pages from D1, reads their full content from R2, parses them to find `[YYYY]` sections, and updates the `onThisDayEntries` table in D1. |

#### Data Flow

1.  **Trigger:** Runs daily via cron schedule (`0 20 * * *`).
2.  **Filter:** Selects pages from D1 that match the `MMDD` title format and have been updated recently (default: last 25 hours).
3.  **Process:** For each page, fetches JSON from R2, parses text.
4.  **Update:** Updates `onThisDayEntries` table with extracted links.

## Building and Running

### Prerequisites

- [pnpm](https://pnpm.io/installation)
- [Cloudflare Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- Dependencies installed via `pnpm install` in the root directory.

### Development

To run this worker locally:

```bash
# Run from the root of the monorepo
pnpm dev:on-this-day
```

### Type Checking

To perform type checking without emitting files:

```bash
pnpm --filter on-this-day exec tsc --noEmit
```
