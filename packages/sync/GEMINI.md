# Package: sync

This document provides context for the `sync` package.

## Overview

This package is a Cloudflare Worker (`w-sync`) responsible for periodically fetching data from Scrapbox and synchronizing it with the application's database and storage.

### Key Technologies

- **Runtime:** [Cloudflare Workers](https://workers.cloudflare.com/)
- **Database:** Accesses Cloudflare D1 via the `@jigsaw/db` package.
- **Storage:** Connects to a Cloudflare R2 bucket.

### Architecture

- The worker's logic is defined in `src/index.ts`.
- It is triggered by a cron schedule (`"0 19 * * *"`) to run automatically once a day.
- It connects to the Scrapbox API to pull project data. This requires an API token or session cookie, which must be configured as a secret (e.g., `SCRAPBOX_TOKEN`) in the Cloudflare dashboard.
- The fetched data is processed and stored in the Cloudflare D1 database (`DB` binding) and potentially in the Cloudflare R2 bucket (`R2` binding) for larger content blobs.

## Building and Running

### Prerequisites

- [pnpm](https://pnpm.io/installation)
- [Cloudflare Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- Dependencies installed via `pnpm install` in the root directory.
- Scrapbox API credentials configured as secrets for local development (`.dev.vars`) and deployment.

### Development

To run this worker locally for development:

```bash
# Run from the root of the monorepo
pnpm dev:sync
```

This starts a local Wrangler server. You will need to provide the required secrets in a `.dev.vars` file for local testing.

### Deployment

To deploy the worker to Cloudflare:

```bash
# Run from the root of the monorepo
pnpm deploy:sync
```
