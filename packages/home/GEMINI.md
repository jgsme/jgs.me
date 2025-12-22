# Package: home

This document provides context for the `home` package.

## Overview

This package is a Cloudflare Worker responsible for serving the site's home page (`jgs.me`). It renders a React-based user interface on the Cloudflare edge network.

### Key Technologies

- **Backend:** [Hono](https://hono.dev/)
- **Frontend:** [React](https://react.dev/) (JSX is processed directly by the Cloudflare Worker)
- **Database:** Accesses Cloudflare D1 via the `@jigsaw/db` package.

### Architecture

- The main entry point is `src/index.tsx`, which defines the Hono application and the React component for the UI.
- It serves static assets from the `public/` directory.
- As per `wrangler.jsonc`, it has a daily cron trigger, suggesting it might perform periodic tasks like cache warming or data pre-fetching.
- It connects to the main D1 database and a KV namespace.

## Building and Running

### Prerequisites

- [pnpm](https://pnpm.io/installation)
- [Cloudflare Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- Dependencies installed via `pnpm install` in the root directory.

### Development

To run this worker locally for development:

```bash
# Run from the root of the monorepo
pnpm dev:home
```

This starts a local Wrangler server on port `8790`.

### Deployment

To deploy the worker to Cloudflare:

```bash
# Run from the root of the monorepo
pnpm deploy:home
```
