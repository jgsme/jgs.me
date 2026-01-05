# Package: notify

This document provides context for the `notify` package.

## Overview

This package is a Cloudflare Worker (`w-notify`) designed to send notifications. Based on the root `README.md`, its primary function is to send updates to a Discord channel.

### Key Technologies

- **Runtime:** [Cloudflare Workers](https://workers.cloudflare.com/)
- **Database:** Accesses Cloudflare D1 via the `@jigsaw/db` package.

### Architecture

- The worker's logic is contained in `src/index.ts`.
- It runs on a schedule, defined by the cron trigger `"0 20 * * *"` in `wrangler.jsonc`. This suggests it runs once a day to check for new content or updates.
- It requires a `DB` binding to connect to the Cloudflare D1 database and a `DISCORD_WEBHOOK_URL` secret (configured in the Cloudflare dashboard) to post messages.

## Building and Running

### Prerequisites

- [pnpm](https://pnpm.io/installation)
- [Cloudflare Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- Dependencies installed via `pnpm install` in the root directory.
- `DISCORD_WEBHOOK_URL` secret configured in Cloudflare for deployments.

### Development

To run this worker locally for development:

```bash
# Run from the root of the monorepo
pnpm dev:notify
```

This starts a local Wrangler server. You will need to provide the required secrets via a `.dev.vars` file for local testing.
