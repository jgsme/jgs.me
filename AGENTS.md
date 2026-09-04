# Project jgs.me

This document provides context for the `jgs.me` personal website project.

## Project Overview

`jgs.me` is a personal website for managing and publishing articles from a frozen Scrapbox export archive (Scrapbox sync was retired in August 2026). It's a modern web application built on Cloudflare's edge infrastructure, utilizing a pnpm monorepo structure.

### Key Technologies

- **Monorepo:** [pnpm workspaces](https://pnpm.io/workspaces)
- **Backend:** [Hono](https://hono.dev/) running on [Cloudflare Workers](https://workers.cloudflare.com/)
- **Frontend:** [React](https://react.dev/) with [Vite](https://vitejs.dev/) and the [Vike](https://vike.dev/) SSR framework.
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Database:** [Cloudflare D1](https://developers.cloudflare.com/d1/) with [Drizzle ORM](https://orm.drizzle.team/)
- **Testing:** [Vitest](https://vitest.dev/)

### Architecture

The project is a monorepo containing several packages within the `packages/` directory:

| Package         | Description                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| `packages/web`  | The main web application serving the UI and API.                                                                |
| `packages/db`   | Shared Drizzle ORM schema for database access.                                                                  |
| `packages/og`   | A Worker for dynamic Open Graph image generation.                                                               |
| `packages/home` | A Worker that serves the home page.                                                                             |
| `packages/cli`  | A CLI (`pnpm undo <url\|id>`) to undo a mis-clicked Discord button by deleting from article/clip/excluded_page. |

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

This will start the Vite development server for the `web` package. Other workers can be developed similarly using the `dev:<worker_name>` scripts (e.g., `pnpm dev:og`).

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

### Undoing a mis-clicked Discord notification button

If a Discord notification button was clicked by mistake, use the `undo` CLI to revert it. It deletes the given page(s) from `article`, `clip`, and `excluded_page`, returning them to the unregistered state.

```bash
pnpm undo <url|id> [<url|id>...]
```

## Development Conventions

- **Database Migrations:** Database schema is managed by Drizzle ORM. To generate a new migration based on changes in `packages/db/src/schema.ts`, run the `gen` script in the `web` package:
  ```bash
  pnpm --filter web gen
  ```
- **Code Style:** Use Prettier for code formatting. Always run `pnpm format` before creating a commit.
- **API Routes:** Backend API logic for the `web` app is located in `packages/web/server/routes/`. New API endpoints should be added here.
- **UI Pages:** Frontend pages are located in `packages/web/pages/`. The application uses Vike's file-based routing.
- **Commit Tracing:** Commit at each meaningful step so the history stays traceable.
- **Approval Flow:** NEVER start implementation before the user explicitly approves the proposed plan in `docs/`.

## Version Control Workflow

**IMPORTANT:** Do NOT push directly to the `main` branch. Always use Pull Requests.

### Development Cycle

1.  **Create a Branch:** Start from an up-to-date `main`.
    ```bash
    git fetch origin
    git switch -c feat/your-feature-name origin/main
    ```
    For work that needs isolation from the current workspace, use a worktree:
    ```bash
    git worktree add .claude/worktrees/<name> -b feat/your-feature-name origin/main
    ```
2.  **Develop & Format:** Make changes, then format the code before committing.
    ```bash
    pnpm format
    git commit -m "feat: description of changes"
    ```
3.  **Push:** **Wait for user approval.** Once approved, push the branch.
    ```bash
    git push -u origin feat/your-feature-name
    ```
4.  **Create Pull Request:** Open a Pull Request targeting `main` with the `gh` CLI.
    ```bash
    gh pr create --base main
    ```
5.  **Merge:** After approval, merge the PR on GitHub.
6.  **Update Local:** Return to `main` and pick up the merged changes.
    ```bash
    git switch main && git pull
    ```
