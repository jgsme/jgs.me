import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { pages, articles, excludedPages, clips } from "@jigsaw/db";
import { generateToken } from "@jigsaw/db/token";
import { eq, isNull, desc, and, sql, SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";

function notGlob(column: SQLiteColumn, pattern: string): SQL {
  return sql`${column} NOT GLOB ${pattern}`;
}

type Env = {
  DB: D1Database;
  DISCORD_WEBHOOK_URL: string;
  REGISTER_SECRET: string;
  SITE_URL: string;
  NOTIFY_WORKFLOW: Workflow;
};

type UnregisteredPage = {
  id: number;
  title: string;
  created: string | null;
};

const MAX_PAGES = 20;

async function getUnregisteredPages(
  d1: D1Database,
): Promise<UnregisteredPage[]> {
  const db = drizzle(d1);

  const result = await db
    .select({
      id: pages.id,
      title: pages.title,
      created: pages.created,
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

  return result;
}

async function sendDiscordMessage(
  webhookUrl: string,
  content: string,
): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord webhook failed: ${res.status} ${text}`);
  }
}

async function sendDiscordNotification(
  env: Env,
  unregisteredPages: UnregisteredPage[],
): Promise<void> {
  if (unregisteredPages.length === 0) {
    return;
  }

  const lines = await Promise.all(
    unregisteredPages.map(async (p) => {
      const token = await generateToken(p.id, env.REGISTER_SECRET);
      const registerUrl = `https://${env.SITE_URL}/api/article/register?token=${token}`;
      const clipUrl = `https://${env.SITE_URL}/api/article/clip?token=${token}`;
      const excludeUrl = `https://${env.SITE_URL}/api/article/exclude?token=${token}`;
      const pageUrl = `https://${env.SITE_URL}/p/${p.id}`;
      const displayTitle =
        p.title.length > 80 ? p.title.slice(0, 80) + "…" : p.title;
      return `- [${displayTitle}](${pageUrl})
  - [記事](${registerUrl})・[クリップ](${clipUrl})・[除外](${excludeUrl})`;
    }),
  );

  const header = `**未登録の記事が ${unregisteredPages.length} 件あるよ**\n\n`;
  const chunks: string[] = [];
  let current = header;

  for (const line of lines) {
    if (current.length + line.length + 1 > 1900) {
      chunks.push(current);
      current = "";
    }
    current += line + "\n";
  }
  if (current) {
    chunks.push(current);
  }

  for (const chunk of chunks) {
    await sendDiscordMessage(env.DISCORD_WEBHOOK_URL, chunk);
  }
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
};
