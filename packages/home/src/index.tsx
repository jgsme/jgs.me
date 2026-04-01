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

const icons: Record<string, string> = {
  github:
    "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
  scrapbox:
    "M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 3c.194 0 .388.04.535.117l4.93 2.592c.296.156.295.406 0 .562L12.32 8.977c-.177.092-.177.244 0 .337l5.145 2.706c.183.096.342.286.44.498l-4.987 2.623a.533.533 0 0 0-.281.476v.002a.536.536 0 0 0 .281.479l4.836 2.545a.948.948 0 0 1-.29.248l-4.929 2.591c-.296.156-.774.156-1.07 0l-4.93-2.591c-.296-.156-.295-.407 0-.563l5.145-2.705c.176-.092.177-.245 0-.338L6.535 12.58a1 1 0 0 1-.373-.367l4.942-2.57a.516.516 0 0 0 .279-.26.554.554 0 0 0 0-.48.515.515 0 0 0-.28-.258l-4.939-2.57a1 1 0 0 1 .371-.366l4.93-2.592A1.19 1.19 0 0 1 12 3zM6 7.176l3.781 1.967L6 11.109V7.176zm12 6.48v3.926l-3.732-1.963L18 13.656z",
  x: "M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z",
  facebook:
    "M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z",
  linkedin:
    "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  steam:
    "M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z",
  lastdotfm:
    "M10.584 17.21l-.88-2.392s-1.43 1.594-3.573 1.594c-1.897 0-3.244-1.649-3.244-4.288 0-3.382 1.704-4.591 3.381-4.591 2.42 0 3.189 1.567 3.849 3.574l.88 2.749c.88 2.666 2.529 4.81 7.285 4.81 3.409 0 5.718-1.044 5.718-3.793 0-2.227-1.265-3.381-3.63-3.931l-1.758-.385c-1.21-.275-1.567-.77-1.567-1.595 0-.934.742-1.484 1.952-1.484 1.32 0 2.034.495 2.144 1.677l2.749-.33c-.22-2.474-1.924-3.492-4.729-3.492-2.474 0-4.893.935-4.893 3.932 0 1.87.907 3.051 3.189 3.601l1.87.44c1.402.33 1.869.907 1.869 1.704 0 1.017-.99 1.43-2.86 1.43-2.776 0-3.93-1.457-4.59-3.464l-.907-2.75c-1.155-3.573-2.997-4.893-6.653-4.893C2.144 5.333 0 7.89 0 12.233c0 4.18 2.144 6.434 5.993 6.434 3.106 0 4.591-1.457 4.591-1.457z",
  keybase:
    "M10.445 21.372a.953.953 0 1 1-.955-.954c.524 0 .951.43.951.955m5.923-.001a.953.953 0 1 1-.958-.954c.526 0 .954.43.954.955m4.544-9.16l-.156-.204c-.046-.06-.096-.116-.143-.175-.045-.06-.094-.113-.141-.169-.104-.12-.21-.239-.32-.359l-.075-.08-.091-.099-.135-.13c-.015-.019-.032-.035-.05-.054a10.87 10.87 0 0 0-3.955-2.504l-.23-.078.035-.083a4.109 4.109 0 0 0-.12-3.255 4.11 4.11 0 0 0-2.438-2.16c-.656-.216-1.23-.319-1.712-.305-.033-.105-.1-.577.496-1.848L10.662 0l-.287.399c-.33.455-.648.895-.945 1.328a1.857 1.857 0 0 0-1.245-.58L6.79 1.061h-.012c-.033-.003-.07-.003-.104-.003-.99 0-1.81.771-1.87 1.755l-.088 1.402v.003a1.876 1.876 0 0 0 1.755 1.98l1.002.06c-.065.84.073 1.62.405 2.306a11.28 11.28 0 0 0-3.66 2.484C.912 14.392.912 18.052.912 20.995v1.775l1.305-1.387c.266.93.652 1.807 1.145 2.615H5.06a9.197 9.197 0 0 1-1.68-3.848l1.913-2.03-.985 3.09 1.74-1.267c3.075-2.234 6.745-2.75 10.91-1.53 1.806.533 3.56.04 4.474-1.256l.104-.165c.09.498.14.998.14 1.496 0 1.563-.254 3.687-1.38 5.512h1.612c.776-1.563 1.181-3.432 1.181-5.512-.001-2.2-.786-4.421-2.184-6.274zM8.894 6.192c.122-1.002.577-1.949 1.23-2.97a1.36 1.36 0 0 0 1.283.749c.216-.008.604.025 1.233.232a2.706 2.706 0 0 1 1.608 1.425c.322.681.349 1.442.079 2.15a2.69 2.69 0 0 1-.806 1.108l-.408-.502-.002-.003a1.468 1.468 0 0 0-2.06-.205c-.334.27-.514.66-.534 1.058-1.2-.54-1.8-1.643-1.628-3.04zm4.304 5.11l-.52.425a.228.228 0 0 1-.323-.032l-.11-.135a.238.238 0 0 1 .034-.334l.51-.42-1.056-1.299a.307.307 0 0 1 .044-.436.303.303 0 0 1 .435.041l2.963 3.646a.309.309 0 0 1-.168.499.315.315 0 0 1-.31-.104l-.295-.365-1.045.854a.244.244 0 0 1-.154.055.237.237 0 0 1-.186-.09l-.477-.58a.24.24 0 0 1 .035-.335l1.05-.858-.425-.533zM7.752 4.866l-1.196-.075a.463.463 0 0 1-.435-.488l.09-1.4a.462.462 0 0 1 .461-.437h.024l1.401.091a.459.459 0 0 1 .433.488l-.007.101a9.27 9.27 0 0 0-.773 1.72zm12.525 11.482c-.565.805-1.687 1.08-2.924.718-3.886-1.141-7.397-.903-10.469.7l1.636-5.122-5.29 5.609c.098-3.762 2.452-6.967 5.757-8.312.471.373 1.034.66 1.673.841.16.044.322.074.48.102a1.41 1.41 0 0 0 .21 1.408l.075.09c-.172.45-.105.975.221 1.374l.476.582a1.39 1.39 0 0 0 1.079.513c.32 0 .635-.111.886-.314l.285-.232c.174.074.367.113.566.113a1.45 1.45 0 0 0 .928-.326c.623-.51.72-1.435.209-2.06l-1.67-2.057a4.07 4.07 0 0 0 .408-.38c.135.036.27.077.4.12.266.096.533.197.795.314a9.55 9.55 0 0 1 2.77 1.897c.03.03.06.055.086.083l.17.176c.038.039.076.079.11.12.08.085.16.175.24.267l.126.15c.045.053.086.104.13.16l.114.15c.04.05.079.102.117.154.838 1.149.987 2.329.404 3.157v.005zM7.718 4.115l-.835-.05.053-.836.834.051z",
};

function Icon({ name, className }: { name: string; className: string }) {
  const path = icons[name];
  if (!path) return null;
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      class={className}
      fill="currentColor"
    >
      <path d={path} />
    </svg>
  );
}

const data = {
  name: "Takaya Kobayashi",
  aka: "Jigsaw, jgs, neo6120",
  copy: "A Web Application/Service Creator",
  mainLinks: [
    { name: "Codes", href: "https://github.com/e-jigsaw", icon: "github" },
    {
      name: "Scrapbox",
      href: "https://scrapbox.io/jigsaw/",
      icon: "scrapbox",
    },
  ],
  links: [
    { name: "neo6120", href: "https://twitter.com/neo6120", icon: "x" },
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
      icon: "steam",
    },
    {
      name: "neo6120",
      href: "https://www.last.fm/user/neo6120",
      icon: "lastdotfm",
    },
    { name: "jgs", href: "https://keybase.io/jgs", icon: "keybase" },
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
                <Icon name={link.icon} className="icon" />
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
                  <Icon name={link.icon} className="icon" />
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
                    href={`https://w.jgs.me/a/${article.id}`}
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
      </body>
    </html>
  );

  return "<!DOCTYPE html>" + html;
}

async function fetchRecentArticles(
  db: ReturnType<typeof drizzle>,
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
    .where(gte(pages.created, twoWeeksAgoStr))
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
