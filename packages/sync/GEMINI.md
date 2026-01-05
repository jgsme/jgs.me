# Package: sync

This document provides context for the `sync` package.

## Overview

This package is a Cloudflare Worker (`w-sync`) responsible for periodically fetching data from Scrapbox and synchronizing it with the application's database and storage. It leverages **Cloudflare Workflows** to manage long-running synchronization tasks.

### Key Technologies

- **Runtime:** [Cloudflare Workers](https://workers.cloudflare.com/)
- **Orchestration:** [Cloudflare Workflows](https://developers.cloudflare.com/workers/runtime-apis/workflows/)
- **Database:** Cloudflare D1 (via `@jigsaw/db`)
- **Storage:** Cloudflare R2 (stores raw page JSON)

### Architecture

The synchronization process uses two workflows:

| Workflow            | Description                                                                                                                                       |
| :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SyncWorkflow`      | The main entry point. Iteratively fetches the page list from Scrapbox, identifies changes, and spawns `SyncBatchWorkflow` instances.              |
| `SyncBatchWorkflow` | Handles the heavy lifting for a batch of pages: fetches full content, stores raw JSON in R2, and updates the article metadata in the D1 database. |

#### Data Flow

1.  **Trigger:** The worker is triggered daily via a cron schedule (`0 19 * * *`).
2.  **Discovery:** `SyncWorkflow` fetches the page list, using a cutoff timestamp to only process recently updated pages.
3.  **Batching:** Pages are grouped into batches, and multiple `SyncBatchWorkflow` instances are created to process them in parallel.
4.  **Storage:** Page details (including full line data) are saved to R2 as `<sbID>.json`. Metadata for search and listing is stored in D1.

> Note: The "On This Day" feature processing has been moved to a separate package (`packages/on-this-day`).

## Building and Running

### Prerequisites

- [pnpm](https://pnpm.io/installation)
- [Cloudflare Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- Dependencies installed via `pnpm install` in the root directory.

### Development

To run this worker locally:

```bash
# Run from the root of the monorepo
pnpm dev:sync
```

### Type Checking

To perform type checking without emitting files:

```bash

# Run from the root of the monorepo

pnpm --filter sync exec tsc --noEmit

```
