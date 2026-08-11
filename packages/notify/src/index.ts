import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { pages, articles, excludedPages, clips } from "@jigsaw/db";
import { eq, isNull, desc, and, sql, SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { verifyKey } from "discord-interactions";
import { applyAction } from "./actions";
import { decide, replaceRow } from "./interactions";
import { buildMessages, resultLabel } from "./message";
import type { DiscordMessage, Interaction, PageSummary } from "./types";

function notGlob(column: SQLiteColumn, pattern: string): SQL {
  return sql`${column} NOT GLOB ${pattern}`;
}

type Env = {
  DB: D1Database;
  DISCORD_BOT_TOKEN: string;
  DISCORD_CHANNEL_ID: string;
  DISCORD_PUBLIC_KEY: string;
  SITE_URL: string;
  NOTIFY_WORKFLOW: Workflow;
};

const MAX_PAGES = 20;

async function getUnregisteredPages(d1: D1Database): Promise<PageSummary[]> {
  const db = drizzle(d1);

  return db
    .select({
      id: pages.id,
      title: pages.title,
    })
    .from(pages)
    .leftJoin(articles, eq(articles.pageID, pages.id))
    .leftJoin(excludedPages, eq(excludedPages.pageID, pages.id))
    .leftJoin(clips, eq(clips.pageID, pages.id))
    .where(
      and(
        isNull(articles.id),
        isNull(excludedPages.id),
        isNull(clips.id),
        notGlob(pages.title, "[0-9][0-9][0-9][0-9][0-9][0-9]"),
        notGlob(pages.title, "[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]"),
      ),
    )
    .orderBy(desc(pages.created))
    .limit(MAX_PAGES);
}

async function postMessage(env: Env, message: DiscordMessage): Promise<void> {
  const res = await fetch(
    `https://discord.com/api/v10/channels/${env.DISCORD_CHANNEL_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord message failed: ${res.status} ${text}`);
  }
}

async function sendDiscordNotification(
  env: Env,
  unregisteredPages: PageSummary[],
): Promise<void> {
  for (const message of buildMessages(unregisteredPages, env.SITE_URL)) {
    await postMessage(env, message);
  }
}

function ephemeral(content: string): Response {
  return Response.json({ type: 4, data: { content, flags: 64 } });
}

export class NotifyWorkflow extends WorkflowEntrypoint<Env, unknown> {
  async run(_event: WorkflowEvent<unknown>, step: WorkflowStep) {
    const unregisteredPages = await step.do(
      "get-unregistered-pages",
      async () => {
        return getUnregisteredPages(this.env.DB);
      },
    );

    await step.do("send-discord-notification", async () => {
      await sendDiscordNotification(this.env, unregisteredPages);
    });

    return { notified: unregisteredPages.length };
  }
}

export default {
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    await env.NOTIFY_WORKFLOW.create();
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/interactions" || request.method !== "POST") {
      return new Response("not found", { status: 404 });
    }

    const signature = request.headers.get("X-Signature-Ed25519") ?? "";
    const timestamp = request.headers.get("X-Signature-Timestamp") ?? "";
    const rawBody = await request.text();

    const valid = await verifyKey(
      rawBody,
      signature,
      timestamp,
      env.DISCORD_PUBLIC_KEY,
    );
    if (!valid) {
      return new Response("invalid request signature", { status: 401 });
    }

    const interaction = JSON.parse(rawBody) as Interaction;
    const decision = decide(interaction);

    if (decision.kind === "pong") return Response.json({ type: 1 });
    if (decision.kind === "unknown") return ephemeral("知らないボタンだ");

    const rows = interaction.message?.components ?? [];

    try {
      const result = await applyAction(
        drizzle(env.DB),
        decision.action,
        decision.pageId,
      );
      return Response.json({
        type: 7,
        data: {
          components: replaceRow(
            rows,
            decision.pageId,
            resultLabel(decision.action, result),
          ),
        },
      });
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      return ephemeral(`失敗した: ${detail}`);
    }
  },
};
