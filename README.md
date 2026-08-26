# jgs.me

A personal website for managing and publishing articles from a frozen Scrapbox export archive (Scrapbox sync was retired in August 2026). Runs on Cloudflare's edge infrastructure.

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Hono, Vike (Universal Deploy via @vikejs/hono), Cloudflare Workers
- **Database**: Cloudflare D1 + Drizzle ORM
- **Storage**: Cloudflare R2, KV
- **Build**: Vite

## Packages

pnpm workspace monorepo.

| Package                      | Description                         |
| ---------------------------- | ----------------------------------- |
| `packages/web`               | Main web app                        |
| `packages/db`                | Shared Drizzle schema               |
| `packages/notify`            | Discord notification worker         |
| `packages/og`                | OG image generation worker          |
| `packages/home`              | Home page worker                    |
| `packages/on-this-day`       | On-this-day entry extraction worker |
| `packages/on-this-day-index` | On-this-day search index worker     |
| `packages/cli`               | Discord button undo CLI             |

## Environment Variables & Bindings

Required Cloudflare bindings:

- `DB` - D1 database
- `R2` - R2 bucket
- `DISCORD_APPLICATION_ID` - Discord app application ID (for notify worker)
- `DISCORD_BOT_TOKEN` - Discord bot token (for notify worker)
- `DISCORD_CHANNEL_ID` - Target channel ID (for notify worker)
- `DISCORD_PUBLIC_KEY` - Discord app public key, used to verify interaction signatures (for notify worker)
- `COMMAND_REGISTER_TOKEN` - Shared secret guarding the slash command registration endpoint (`POST /register`, for notify worker)
- `SITE_URL` - Site URL
