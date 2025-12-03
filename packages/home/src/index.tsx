import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { desc, eq, gte } from "drizzle-orm";
import { articles, pages } from "@jigsaw/db";
import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";

type Bindings = {
  DB: D1Database;
  KV: KVNamespace;
  CACHE_WORKFLOW: Workflow;
};

const KV_KEY = "home-html";

const app = new Hono<{ Bindings: Bindings }>();

const data = {
  name: "Takaya Kobayashi",
  aka: "Jigsaw, jgs, neo6120",
  copy: "A Web Application/Service Creator",
  mainLinks: [
    { name: "Codes", href: "https://github.com/e-jigsaw", icon: "github" },
    {
      name: "Scrapbox",
      href: "https://scrapbox.io/jigsaw/",
      icon: "square-pen",
    },
  ],
  links: [
    { name: "neo6120", href: "https://twitter.com/neo6120", icon: "twitter" },
    {
      name: "takaya.kobayashi",
      href: "https://fb.me/takaya.kobayashi",
      icon: "facebook",
    },
    {
      name: "takaya-kobayashi",
      href: "https://www.linkedin.com/in/takaya-kobayashi/",
      icon: "linkedin",
    },
    {
      name: "neo6120",
      href: "https://steamcommunity.com/id/neo6120",
      icon: "gamepad-2",
    },
    {
      name: "neo6120",
      href: "https://www.last.fm/user/neo6120",
      icon: "music",
    },
    { name: "jgs", href: "https://keybase.io/jgs", icon: "key-round" },
  ],
};

type RecentArticle = {
  id: number;
  title: string;
  created: string;
};

async function generateHtml(recentArticles: RecentArticle[]): Promise<string> {
  const html = (
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width" />
        <title>Takaya Kobayashi</title>
        <link
          rel="shortcut icon"
          type="image/x-icon"
          href="/static/favicon.ico"
        />
        <meta name="author" content="Takaya Kobayashi" />
        <meta name="description" content="About Takaya Kobayashi" />
        <meta name="theme-color" content="#BD3129" />
        <meta property="og:title" content="Takaya Kobayashi" />
        <meta property="og:url" content="https://jgs.me" />
        <meta property="og:image" content="https://og.w.jgs.me/default.png" />
        <meta property="og:image:width" content="400" />
        <meta property="og:image:height" content="400" />
        <meta property="og:description" content="About Takaya Kobayashi" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:site" content="@neo6120" />
        <meta name="twitter:creator" content="@neo6120" />
        <meta name="msapplication-TileColor" content="#bd3129" />
        <link
          href="https://fonts.googleapis.com/css?family=Cutive+Mono"
          rel="stylesheet"
        />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/static/apple-touch-icon.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/static/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/static/favicon-16x16.png"
        />
        <link rel="manifest" href="/static/site.webmanifest" />
        <link
          rel="mask-icon"
          href="/static/safari-pinned-tab.svg"
          color="#bd3129"
        />
        <style>{`
          html, body {
            margin: 0;
            padding: 0;
          }

          header {
            position: relative;
            height: 4rem;
            margin-bottom: 2rem;
            display: flex;
            flex-direction: row;
            justify-content: center;
            font-family: monospace;
            padding: 0.3rem 0;
            background-color: #82221c;
            overflow: visible;
          }

          header a {
            width: 100%;
            height: 100%;
            position: absolute;
            top: 0;
            left: 0;
          }

          header svg {
            fill: #efefef;
            width: 100%;
            height: 100%;
            position: absolute;
            top: 0.3rem;
            z-index: 1;
          }

          .header-triangle {
            width: 0;
            height: 0;
            border-left: 7rem solid transparent;
            border-right: 7rem solid transparent;
            border-top: 7rem solid #bd3129;
            border-bottom: 0 solid transparent;
            position: absolute;
            top: 0;
            left: 50%;
            margin-left: -7rem;
          }

          #page-1 {
            height: calc(100vh - 10rem);
          }

          .profile {
            text-align: center;
            font-family: Cutive Mono, monospace;
          }

          .profile .photo img {
            width: 15rem;
            height: 15rem;
            border-radius: 15rem;
          }

          .profile h1, .profile h2 {
            margin: 0;
          }

          .copy {
            text-align: center;
            font-family: serif;
          }

          .main-links {
            display: flex;
            flex-direction: row;
            justify-content: center;
            font-size: 2rem;
            font-family: monospace;
          }

          .link {
            color: #333;
            text-decoration: none;
            display: block;
            margin: 0 1rem;
          }

          .link:hover {
            color: #333;
            text-decoration: underline;
          }

          .link:active {
            color: #bd3129;
          }

          .link:visited {
            color: #333;
          }

          .main-links .icon {
            width: 28px;
            height: 28px;
            margin-right: 0.5rem;
            position: relative;
            top: 4px;
          }

          .link-grid .icon {
            width: 24px;
            height: 24px;
            margin-right: 0.5rem;
            position: relative;
            top: 2px;
          }

          #page-2 {
            height: calc(100vh - 20rem);
          }

          #page-3, #page-4, #page-5 {
            margin-bottom: 20rem;
          }

          .links h3 {
            text-align: center;
            font-weight: normal;
            width: 80vw;
            margin: 0 auto;
            border-bottom: 1px solid #666;
            line-height: 0;
          }

          .links h3 span {
            background-color: #fff;
            padding: 0 2rem;
          }

          .link-grid {
            display: grid;
            grid-template-columns: auto auto;
            grid-gap: 1rem 2rem;
            margin: 1.5rem auto;
            justify-content: center;
          }

          .link-grid a {
            margin: 0;
          }

          .link-grid a span {
            position: relative;
            top: -0.2rem;
          }

          .update-container {
            margin: 1.5rem auto;
          }

          .update-link {
            width: 50vw;
            margin: 0 auto;
            margin-bottom: 1rem;
          }

          @media (max-width: 376px) {
            .update-link {
              width: 90vw;
              margin: 0 auto;
              margin-bottom: 1rem;
            }
          }

          .update-link div:nth-of-type(1) {
            font-size: 1.5rem;
          }
        `}</style>
      </head>
      <body>
        <header>
          <a href="/">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 115.17 108.76">
              <path d="M50.61,40.08H87.34L75.63,50.85l-.11,48-10.4,9.91,0-33.23-15.57,0L49.5,98.85l-10.68,9.91v-58M49.58,64.8l15.57,0v-14H49.58Z" />
              <polyline points="9.49 15.33 0 0 58.42 21.78 115.17 0 105.32 15.33 67.84 28.21 113.21 28.3 103.13 39.05 0.38 38.97 9.03 28.15 48.54 27.49" />
              <polyline points="100.58 76.31 76.65 76.31 76.65 51.53 89.12 40.08 89.12 65.6 104.04 65.6 104.41 39.55 115.17 28.3 115.17 75.75 80.92 108.76 66.82 108.76" />
              <polygon points="17.71 98.85 17.71 50.84 9.03 50.84 0.38 40.08 48.54 40.08 37.19 50.84 28.42 50.84 28.42 108.76 17.71 98.85" />
            </svg>
          </a>
          <div class="header-triangle"></div>
        </header>

        <div id="page-1">
          <div class="profile">
            <div class="photo">
              <img src="/static/v2.webp" alt={data.name} />
            </div>
            <h1>{data.name}</h1>
            <h2>a.k.a.&nbsp;{data.aka}</h2>
          </div>
          <div class="copy">
            <p>{data.copy}</p>
          </div>
          <div class="main-links">
            {data.mainLinks.map((link) => (
              <a class="link" href={link.href}>
                <i data-lucide={link.icon} class="icon"></i>
                {link.name}
              </a>
            ))}
          </div>
        </div>

        <div id="page-2">
          <div class="links">
            <h3>
              <span>Links</span>
            </h3>
            <div class="link-grid">
              {data.links.map((link) => (
                <a class="link" href={link.href}>
                  <i data-lucide={link.icon} class="icon"></i>
                  <span>{link.name}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div id="page-3">
          <div class="links">
            <h3>
              <span>Recent Articles</span>
            </h3>
            <div class="update-container">
              {recentArticles.length > 0 &&
                recentArticles.map((article) => (
                  <a
                    href={`https://w.jgs.me/p/${article.id}`}
                    class="update-link link"
                  >
                    <div>{article.title}</div>
                    <div>
                      {new Date(article.created).toLocaleDateString("en-US")}
                    </div>
                  </a>
                ))}
            </div>
          </div>
        </div>

        <div id="page-5">
          <div class="links">
            <h3>
              <span>More Info</span>
            </h3>
            <div class="update-container">
              <a href="https://w.jgs.me/pages/jgs" class="update-link link">
                <div>About me (ja)</div>
              </a>
            </div>
          </div>
        </div>
        <script src="https://unpkg.com/lucide@latest"></script>
        <script>{`lucide.createIcons();`}</script>
      </body>
    </html>
  );

  return "<!DOCTYPE html>" + html;
}

async function fetchRecentArticles(
  db: ReturnType<typeof drizzle>
): Promise<RecentArticle[]> {
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const twoWeeksAgoStr = twoWeeksAgo.toISOString();

  return db
    .select({
      id: articles.id,
      title: pages.title,
      created: pages.created,
    })
    .from(articles)
    .innerJoin(pages, eq(articles.pageID, pages.id))
    .where(gte(articles.created, twoWeeksAgoStr))
    .orderBy(desc(pages.created))
    .limit(10);
}

app.get("/", async (c) => {
  const cached = await c.env.KV.get(KV_KEY);
  if (cached) {
    return c.html(cached);
  }

  const db = drizzle(c.env.DB);
  const recentArticles = await fetchRecentArticles(db);
  const html = await generateHtml(recentArticles);
  return c.html(html);
});

export class CacheWorkflow extends WorkflowEntrypoint<Bindings, unknown> {
  async run(_event: WorkflowEvent<unknown>, step: WorkflowStep) {
    await step.do("regenerate-cache", async () => {
      const db = drizzle(this.env.DB);
      const recentArticles = await fetchRecentArticles(db);
      const html = await generateHtml(recentArticles);
      await this.env.KV.put(KV_KEY, html);
      return { regenerated: true };
    });

    return { success: true };
  }
}

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Bindings) {
    const db = drizzle(env.DB);
    const recentArticles = await fetchRecentArticles(db);
    const html = await generateHtml(recentArticles);
    await env.KV.put(KV_KEY, html);
    console.log("Home page HTML generated and cached to KV");
  },
};
