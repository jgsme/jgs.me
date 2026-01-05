# Package: on-this-day-index

This document provides context for the `on-this-day-index` package.

## Overview

This package is a Cloudflare Worker (`w-on-this-day-index`) responsible for generating the search index for the "On This Day" feature. It aggregates data from the `onThisDayEntries` database table into a lightweight JSON file served from R2.

### Key Technologies

- **Runtime:** [Cloudflare Workers](https://workers.cloudflare.com/)
- **Orchestration:** [Cloudflare Workflows](https://developers.cloudflare.com/workers/runtime-apis/workflows/)
- **Database:** Cloudflare D1 (via `@jigsaw/db`)
- **Storage:** Cloudflare R2 (stores `on-this-day-index.json`)

### Architecture

The worker uses a single workflow:

| Workflow | Description |
| :--- | :--- |
| `OnThisDayIndexWorkflow` | Fetches all entries from the `onThisDayEntries` table, aggregates counts by date and year, and writes a compressed index JSON to R2. |

#### Data Flow

1.  **Trigger:** Currently triggered manually via CLI (`wrangler workflows trigger`) or Cloudflare Dashboard.
2.  **Aggregate:** Queries D1 for all historical entries.
3.  **Optimize:** Structures data into a compact JSON format to minimize file size.
4.  **Publish:** Uploads `on-this-day-index.json` to R2.

## Building and Running

### Prerequisites

- [pnpm](https://pnpm.io/installation)
- [Cloudflare Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- Dependencies installed via `pnpm install` in the root directory.

### Development

To run this worker locally:

```bash
# Run from the root of the monorepo
pnpm dev:on-this-day-index
```

### Type Checking

To perform type checking without emitting files:

```bash
pnpm --filter on-this-day-index exec tsc --noEmit
```
