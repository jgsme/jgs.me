# Package: notify

This document provides context for the `notify` package.

## Overview

This package is a Cloudflare Worker (`w-notify`). It notifies a Discord channel about unregistered pages, handles the button presses on those notifications, and serves a `/pull` slash command that triggers the same notification on demand.

### Key Technologies

- **Runtime:** [Cloudflare Workers](https://workers.cloudflare.com/)
- **Database:** Accesses Cloudflare D1 via the `@jigsaw/db` package.

### Architecture

- `src/index.ts` is wiring only. The logic lives in focused modules that depend on `src/types.ts` in one direction: `message.ts` (message and label construction), `interactions.ts` (interaction parsing and component rewriting), `actions.ts` (D1 writes), `commands.ts` (slash command definitions), `auth.ts` (bearer token check).
- It runs once a day on the cron trigger `"0 20 * * *"` in `wrangler.jsonc` — 20:00 UTC, which is 05:00 JST.
- It requires a `DB` binding to connect to the Cloudflare D1 database, and the `DISCORD_APPLICATION_ID` / `DISCORD_BOT_TOKEN` / `DISCORD_CHANNEL_ID` / `DISCORD_PUBLIC_KEY` / `COMMAND_REGISTER_TOKEN` / `SITE_URL` secrets (configured in the Cloudflare dashboard).

The `fetch` handler serves two routes; everything else returns 404.

| Route                | Auth                                             | Purpose                                                                                                            |
| -------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `POST /interactions` | Discord Ed25519 signature                        | Button presses and the `/pull` slash command                                                                       |
| `POST /register`     | `Authorization: Bearer <COMMAND_REGISTER_TOKEN>` | Registers the slash commands with Discord (`PUT /applications/{id}/commands`, a full replace, so it is idempotent) |

`/pull` answers with a deferred response (`type: 5`) because posting up to four messages does not fit in Discord's 3-second budget. The work continues in `ctx.waitUntil` and the deferred reply is then edited to report how many pages were posted.

## Building and Running

### Prerequisites

- [pnpm](https://pnpm.io/installation)
- [Cloudflare Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- Dependencies installed via `pnpm install` in the root directory.
- `DISCORD_APPLICATION_ID` / `DISCORD_BOT_TOKEN` / `DISCORD_CHANNEL_ID` / `DISCORD_PUBLIC_KEY` / `COMMAND_REGISTER_TOKEN` / `SITE_URL` secrets configured in Cloudflare for deployments.

### Development

To run this worker locally for development:

```bash
# Run from the root of the monorepo
pnpm dev:notify
```

This starts a local Wrangler server. You will need to provide the required secrets via a `.dev.vars` file for local testing.

## Deployment

This worker exposes `POST /interactions`, so a real deployment requires registering it with Discord, not just running `wrangler deploy`.

1. Set the secrets with `wrangler secret put`: `DISCORD_APPLICATION_ID`, `DISCORD_BOT_TOKEN`, `DISCORD_CHANNEL_ID`, `DISCORD_PUBLIC_KEY`, and `COMMAND_REGISTER_TOKEN`. The last one only guards `/register`, but that route is publicly reachable, so generate it rather than inventing one: `openssl rand -hex 32`.
2. Run `wrangler deploy`. The output prints the worker's `https://w-notify.<subdomain>.workers.dev` URL — `<subdomain>` is account-specific and only known after this step.
3. In the Discord Developer Portal, set the Interactions Endpoint URL to `https://w-notify.<subdomain>.workers.dev/interactions` and save.
4. On save, Discord immediately probes the endpoint with a PING and with a deliberately invalid signature. Saving succeeds only if both signature verification and the PONG response are correct — a failed save means something above is wrong.
5. Register the slash commands once:

   ```bash
   curl -X POST "https://w-notify.<subdomain>.workers.dev/register" \
     -H "Authorization: Bearer $COMMAND_REGISTER_TOKEN"
   ```

   Re-run this whenever `buildCommandsPayload()` in `src/commands.ts` changes. `PUT /applications/{id}/commands` replaces the whole set, so repeated runs are harmless.

The bot must be invited with the `applications.commands` scope for slash commands to appear, not just `bot`. If it was invited before the commands existed, re-authorize with the extra scope:

```
https://discord.com/api/oauth2/authorize?client_id=<DISCORD_APPLICATION_ID>&permissions=3072&scope=bot%20applications.commands
```

`SITE_URL` is unrelated to the signature handshake; it's only used to build the article links embedded in the button rows.
