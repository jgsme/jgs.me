# Package: web

This document provides context for the `web` package.

## Overview

This is the main package for the `jgs.me` project. It is a full-stack application running on Cloudflare Pages, serving both the user-facing website and the backend API.

### Key Technologies

- **Framework:** [Vike](https://vike.dev/) (Vite-based SSR framework)
- **UI Library:** [React](https://react.dev/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Backend API:** [Hono](https://hono.dev/)
- **Build Tool:** [Vite](https://vitejs.dev/)
- **Database:** [Drizzle ORM](https://orm.drizzle.team/) connecting to Cloudflare D1.
- **Testing:** [Vitest](https://vitest.dev/)

### Architecture

- **File-based Routing:** The application uses Vike's file-based routing, with pages located in `pages/`. Each page can have its own data-loading logic (`+data.ts`), UI component (`+Page.tsx`), and metadata (`+Head.tsx`).
- **SSR + SPA:** It operates as a Server-Side Rendered (SSR) application that hydrates into a Single-Page Application (SPA) on the client side.
- **Backend Server:** A Hono application, defined in `server/index.ts`, runs as the server-side backend. It handles API routes (`/api`), redirects, and the RSS feed. This server code is the entry point for the Cloudflare Pages deployment.
- **Database Migrations:** This package is responsible for managing and generating database migrations for the entire project using Drizzle Kit.

## Building and Running

### Prerequisites

- [pnpm](https://pnpm.io/installation)
- [Cloudflare Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- Dependencies installed via `pnpm install` in the root directory.

### Development

To run the application in development mode:

```bash
# Run from the root of the monorepo
pnpm dev
```

This starts the Vite development server.

### Building

To build the application for production:

```bash
# Run from the root of the monorepo
pnpm build
```

This command runs `vite build`, which builds both the client and server assets.

### Testing

To run the unit and integration tests:

```bash
# Run from the root of the monorepo
pnpm --filter web test
```

### Database Migrations

To generate a new migration after changing the schema in `packages/db/src/schema.ts`:

```bash
# Run from the root of the monorepo
pnpm --filter web gen
```
