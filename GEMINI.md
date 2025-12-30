# Project jgs.me

This document provides context for the `jgs.me` personal website project.

## Project Overview

`jgs.me` is a personal website for managing and publishing articles from Scrapbox. It's a modern web application built on Cloudflare's edge infrastructure, utilizing a pnpm monorepo structure.

### Key Technologies

- **Monorepo:** [pnpm workspaces](https://pnpm.io/workspaces)
- **Backend:** [Hono](https://hono.dev/) running on [Cloudflare Workers](https://workers.cloudflare.com/)
- **Frontend:** [React](https://react.dev/) with [Vite](https://vitejs.dev/) and the [Vike](https://vike.dev/) SSR framework.
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Database:** [Cloudflare D1](https://developers.cloudflare.com/d1/) with [Drizzle ORM](https://orm.drizzle.team/)
- **Testing:** [Vitest](https://vitest.dev/)

### Architecture

The project is a monorepo containing several packages within the `packages/` directory:

| Package           | Description                                         |
| ----------------- | --------------------------------------------------- |
| `packages/web`    | The main web application serving the UI and API.    |
| `packages/db`     | Shared Drizzle ORM schema for database access.      |
| `packages/sync`   | A Cloudflare Worker to sync articles from Scrapbox. |
| `packages/notify` | A Worker for sending Discord notifications.         |
| `packages/og`     | A Worker for dynamic Open Graph image generation.   |
| `packages/home`   | A Worker that serves the home page.                 |

The `web` package is the core, handling most user-facing functionality. It's a server-side rendered (SSR) React application using Vike, with a Hono backend for API routes, all running on Cloudflare Pages.

## Building and Running

### Prerequisites

- [pnpm](https://pnpm.io/installation)
- [Cloudflare Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/) CLI (for deployment).
- Correctly configured Cloudflare bindings and environment variables as specified in `README.md`.

### Development

To run the main web application locally:

```bash
# Install dependencies for all packages
pnpm install

# Run the web app in development mode
pnpm dev
```

This will start the Vite development server for the `web` package. Other workers can be developed similarly using the `dev:<worker_name>` scripts (e.g., `pnpm dev:sync`).

### Building

To build the application for production:

```bash
# Build the web app
pnpm build
```

This command runs `vite build` within the `web` package.

### Testing

To run the test suite for the `web` package:

```bash
pnpm --filter web test
```

## Development Conventions

- **Database Migrations:** Database schema is managed by Drizzle ORM. To generate a new migration based on changes in `packages/db/src/schema.ts`, run the `gen` script in the `web` package:
  ```bash
  pnpm --filter web gen
  ```
- **Code Style:** The project uses Prettier for code formatting (inferred from common JS/TS project standards, though no `.prettierrc` is visible) and ESLint (inferred). Adhere to the existing style.
- **API Routes:** Backend API logic for the `web` app is located in `packages/web/server/routes/`. New API endpoints should be added here.
- **UI Pages:** Frontend pages are located in `packages/web/pages/`. The application uses Vike's file-based routing.
- **Commit Tracing:** Ensure traceability by executing the `jj describe` command after each step.
- **Approval Flow:** NEVER start implementation before the user explicitly approves the proposed plan in `docs/`.

## Version Control Workflow (Jujutsu)

**IMPORTANT:** Do NOT push directly to the `main` branch. Always use Pull Requests.

### Initial Setup

Configure `jj` to automatically track bookmarks from the remote to simplify the push workflow.
```bash
jj config set --user remotes.origin.auto-track-bookmarks '"glob:*"'
```

### Development Cycle

1.  **Create a Bookmark:** Start a new bookmark for your task.
    ```bash
    jj new main -m "feat: description of changes"
    jj bookmark set feat/your-feature-name
    ```
2.  **Develop & Commit:** Make changes and update the commit description.
    ```bash
    jj describe -m "feat: updated description"
    ```
3.  **Push Bookmark:** Push your specific bookmark to the remote.
    ```bash
    jj git push --bookmark feat/your-feature-name
    ```
4.  **Create Pull Request:** Open a Pull Request on GitHub targeting `main`.
5.  **Merge:** After approval, merge the PR on GitHub.
6.  **Update Local:** Fetch changes and rebase your work if needed.
    ```bash
    jj git fetch
    jj rebase -d main
    ```
