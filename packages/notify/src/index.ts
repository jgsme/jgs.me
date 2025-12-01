import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { pages, articles } from "@jigsaw/db";
import { generateToken } from "@jigsaw/db/token";
import { eq, isNull, desc } from "drizzle-orm";

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
  d1: D1Database
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
    .where(isNull(articles.id))
    .orderBy(desc(pages.created))
    .limit(MAX_PAGES);

  return result;
}

async function sendDiscordNotification(
  env: Env,
  unregisteredPages: UnregisteredPage[]
): Promise<void> {
  if (unregisteredPages.length === 0) {
    return;
  }

  const lines = await Promise.all(
    unregisteredPages.map(async (p) => {
      const token = await generateToken(p.id, env.REGISTER_SECRET);
      const registerUrl = `https://${env.SITE_URL}/api/article/register?token=${token}`;
      return `- ${p.title} ([登録](${registerUrl}))`;
    })
  );

  const content = [
    `**未登録の記事が ${unregisteredPages.length} 件あるよ**`,
    "",
    ...lines,
  ].join("\n");

  const res = await fetch(env.DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord webhook failed: ${res.status} ${text}`);
  }
}

export class NotifyWorkflow extends WorkflowEntrypoint<Env, unknown> {
  async run(_event: WorkflowEvent<unknown>, step: WorkflowStep) {
    const unregisteredPages = await step.do(
      "get-unregistered-pages",
      async () => {
        return getUnregisteredPages(this.env.DB);
      }
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
    _ctx: ExecutionContext
  ): Promise<void> {
    await env.NOTIFY_WORKFLOW.create();
  },
};
