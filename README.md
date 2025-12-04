# jgs.me

A personal website for managing and publishing articles from Scrapbox. Runs on Cloudflare's edge infrastructure.

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Hono, Photon, Cloudflare Workers/Pages
- **Database**: Cloudflare D1 + Drizzle ORM
- **Storage**: Cloudflare R2, KV
- **Build**: Vite

## Packages

pnpm workspace monorepo.

| Package           | Description                 |
| ----------------- | --------------------------- |
| `packages/web`    | Main web app                |
| `packages/db`     | Shared Drizzle schema       |
| `packages/sync`   | Scrapbox sync worker        |
| `packages/notify` | Discord notification worker |
| `packages/og`     | OG image generation worker  |
| `packages/home`   | Home page worker            |

## Environment Variables & Bindings

Required Cloudflare bindings:

- `DB` - D1 database
- `R2` - R2 bucket
- `REGISTER_SECRET` - Token signing key for article registration
- `DISCORD_WEBHOOK_URL` - Discord Webhook URL (for notify worker)
- `SITE_URL` - Site URL
