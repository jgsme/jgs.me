# Project jgs.me

このファイルは、このリポジトリで作業するエージェント共通の指示とプロジェクト情報をまとめる。package 固有の指示は各 `packages/*/AGENTS.md` を参照する。

## Project Overview

`jgs.me` は記事・clip・zet を管理・公開する個人サイト。Scrapbox 同期は 2026 年 8 月に廃止され、export archive は凍結済み。新規ページは Micropub (`packages/ingest`) 経由で取り込む。

pnpm workspaces のモノレポで、Cloudflare Workers / D1 / R2 を使用する。Web は Vike + React + Hono、スタイルは Tailwind CSS (design token は npm の [`laque`](https://github.com/jgsme/laque))、DB は Drizzle ORM、テストは Vitest。

## Commands

pnpm と Cloudflare Wrangler を使用する。必要な bindings と環境変数は `README.md` と各 package の `wrangler.jsonc` を確認する。

```bash
# Setup & Development
pnpm install
pnpm dev                       # web の Vite dev server
pnpm dev:og                     # OG Worker
pnpm dev:home                   # home Worker
pnpm dev:ingest                 # Micropub Worker

# Build & Preview
pnpm build                     # web の production build
pnpm --filter web preview      # wrangler dev

# Test & Format & Lint
pnpm --filter web test          # Vitest
pnpm --filter web test --run    # 単発実行
pnpm format                    # commit 前に実行
pnpm format:check
pnpm lint:tokens               # design token から外れた書き方を検出

# Database
pnpm --filter @jigsaw/db gen    # drizzle-kit generate

# CLI Tools
pnpm undo <url|id> [<url|id>...] # 登録を取り消す（article/clip/excluded_page/druck と w-md から削除）
pnpm kind <url|id> <kind>       # clip.kind を変更 (link/quote/photo/video)
pnpm kind --csv <path>         # CSV から一括変更
pnpm md-backfill               # 検索インデックス用の md (w-md) を既存ページぶん埋める
pnpm zet-rehost                # 取り込み済み zet の画像を PDS の blob から w-media に写す
pnpm clip-margin [--dry-run|--delete] # clip を Margin の at.margin.note として PDS に書き、clips コレクションに入れる。--delete は消す
pnpm standard-publication      # standard.site の publication record (w.jgs.me) を PDS に書く。冪等
```

## Architecture

### Packages

| Package           | Description                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| `packages/db`     | 共有 Drizzle スキーマ（`@jigsaw/db` としてインポート）                                                             |
| `packages/web`    | メインの Web UI / API（Vike + React + Hono、Cloudflare Workers / Universal Deploy）                                |
| `packages/og`     | OG 画像生成 Worker（Satori + Resvg）                                                                               |
| `packages/home`   | ホームページ用 Worker                                                                                              |
| `packages/cli`    | undo、kind、md-backfill、zet-rehost などの CLI                                                                     |
| `packages/ingest` | Micropub 経由の取り込み、D1 migration の実行元。news 用の crawl と clef の中継は 2026-11-09 に別の Worker に移した |

### Web App (packages/web)

Vike の Universal Deploy (`@vikejs/hono`) と `@cloudflare/vite-plugin` を使用する。Cloudflare Workers 向けのビルド成果物 `dist/w` が実デプロイ単位。

`+server.ts` が Hono サーバーエントリポイント。`@vikejs/hono` の `vike()` で Vike と統合し、`export default { fetch: app.fetch } satisfies Server` で公開する。

### Database

Cloudflare D1 (SQLite) + Drizzle ORM。スキーマは `packages/db/src/schema.ts`、migration は `packages/db/drizzle/`。D1 binding は `DB`（`wrangler.jsonc` で定義）。

#### migration の当て方

**merge しても本番には当たらない。手で打つ。** CI (`.github/workflows/ci.yml`) は format・lint・OG テストを実行するが、D1 migration は実行しない。Workers Builds は Worker を deploy するだけで D1 は触らない。

```bash
cd packages/ingest
npx wrangler d1 migrations list w --remote   # 未適用を確認
npx wrangler d1 migrations apply w --remote  # 適用
```

1. `packages/ingest` から打つ。`migrations_dir: "../db/drizzle"` がここの `wrangler.jsonc` にあるため。`packages/web` から打っても未適用が見つからない。
2. `--remote` を付けないとローカルの SQLite に当たる。ローカル DB は実行元と persist 設定に依存するため、ingest で当てたものを web が共有するとは限らない。
3. **stdin をパイプにしない。** `yes | wrangler ...` は `The given account is not valid or is not authorized to access this service [code: 7403]` で落ちる。非対話でもそのまま打てば「fallback value: yes」で進む。
4. 適用前に `migrations list w --remote` で未適用を確認する。

通常は schema を変える PR を merge → migration を当てる → データを入れる。カラム追加 (`ADD COLUMN ... DEFAULT`) は既存コードが読まないので、deploy より先に当ててよい。

**読む側のコードと同じ PR で表を足すときは、merge より前に当てる。** merge で Workers Builds が deploy し、新しいコードが無い表を引いて落ちる（zet 表の追加がこれ）。branch の worktree の `packages/ingest` から上記の apply を打てば、その branch の migration が当たる。

### Pages (Vike)

`packages/web/pages/` のファイルベースルーティング。

1. `+Page.tsx` — ページコンポーネント
2. `+data.ts` — サーバーサイドデータフェッチ
3. `+config.ts` — ページ設定
4. `+route.ts` — カスタムルート定義
5. `pages/Layout.tsx` — レイアウト

### Page Structure

以下のパスは `packages/web/` 基準。

1. `pages/index/` — 記事一覧（ページネーション `?p=N`）。
2. `pages/article/@title/` — 記事詳細（`/pages/@title`）。R2 から本文を取得し、`@progfay/scrapbox-parser` でパースする。本文は Scrapbox archive の `<scrapbox-id>.json` または Micropub (diary) の `<sb-uuid>.sb`。どちらも 1 行目が題。同期廃止で `.json` は増えないが、Micropub 経由でページ自体は増える。
   HTML 記事は druck として入る（`article` には入らない）。トップの article 一覧・周年日記・検索・suggest・関連記事には出ず、`/rss.xml` には article と混ぜる。HTML 記事 (`html-` 始まりの bodyKey) は `html-<uuid>.render.json` (ingest が組み直したもの) をページの中の `.jgs-html-article` に描く。iframe は使わず、CSS は scope 済み。CSP はこのページにだけ付き、`+data` が `pageContext.headersResponse` に積む (vike は `+headersResponse` を `+data` より先に解決するので、`+headersResponse` では書けない)。HTML article への出入りはページを丸ごと読み込む (`+onPageTransitionStart`)。
   通常の article の本文の `code:xhtm` (diary の部品) は中身が `{"key":"<sha256>.json"}` 1 行で、部品の JSON (`{ styles, libs, body, scripts }`) は w-media (ingest の media endpoint が書く。web は binding `MEDIA` で読むだけ) にある。`+data` が SSR で読み (`xhtmParts.ts`)、読めない・壊れたものはその部品だけ描かない。`styles` と `body` は `div.xhtm-host` に innerHTML で描き、`scripts` は effect で `new Function("root", code)(root)` として呼んで戻り値の関数を cleanup で呼ぶ (`components/xhtmPart.ts` の `runXhtmPart`。`libs` はページ内で src ごとに 1 回だけ読む)。なのでクライアント遷移で出入りしても読み込み直さない。script は w.jgs.me の origin で CSP 無しで動く (通常の article に CSP は無い。druck の CSP は `frame-src 'none'` で同じ記事の YouTube 埋め込みを壊すので掛けない)。
3. `/a/{id}` — `/pages/{title}` への共有 URL リダイレクト。clip は `/c/{id}`、zet は `/z/{zet.id}`。実体は `server/routes/redirects.ts`、形式は `utils/permalink.ts`。7 日 edge cache、ingest が update 時に purge する。
4. `pages/search/` — 検索。
5. `pages/clips/` — clip 一覧。
6. `pages/zets/` — zet 一覧（`zet.date` 降順、`?p=N`）。個別は専用ページを持たず、記事と同じ `pages/article/@title/` が `/pages/zet%3A<rkey>` で表示する。見出しと `<title>` は `zet.title`、無ければ `zet.date`。`zet:<rkey>` は表示しない。
7. `pages/on-this-day/@mmdd/` — 周年日記（`/on-this-day/@mmdd`）。`article.date` の月日が一致する記事を年ごとにグルーピングする。
8. `pages/drucks/` — druck 一覧（`/drucks`、`druck.date` 降順、`?p=N`）。入口はトップの druck 枠（最近 6 件）の「もっと見る」だけ。共有 URL は `/d/{druck.id}`（`/pages/{title}` へリダイレクト）。Bluesky / Threads の投稿文は題を先頭に置く (本文の頭が HTML のヘッダの飾りの文字になりがちなため。`leadTitle`)。
9. `pages/draft/@key/` — 公開前の article（`/drafts/<鍵>`）。page を引かず `draft` 表だけを読む。edge cache に載せず（`createCacheMiddleware` を通さない）、`Cache-Control: no-store` / `X-Robots-Tag: noindex` / `Referrer-Policy: no-referrer` を返す。このヘッダは `+data`（`applyDraftHeaders`）と `+server.ts` の `/drafts/*` middleware の 2 箇所で積む。`+data` が `render(404)` を投げると vike は新しい pageContext でエラーページを描き、`+data` で積んだ分が落ちるため、404 にも middleware で付ける。`<title>` と `og:title` は固定の `下書き - I am Electrical machine`（`+title.ts`。vike-react は `title` から `og:title` も出すので題を入れない）で、description・OG 画像・OG の題と抜粋は出さない。gtag は `pages/+Head.tsx` が `isDraftPath` で外す（鍵入りの URL を Google に渡さない）。詳細は「draft (公開前の確認)」。

zet 本文も R2 の `.sb`。画像は取り込み時に PDS の blob を w-media に写し、Image Transformations 用に r2.jgs.me の URL に差し替える。写せなかった blob だけ getBlob URL に `#.png` を付けて画像として読み込み、`pnpm zet-rehost` で後から拾う。

### API Routes

Hono ハンドラは `packages/web/server/routes/` に配置し、`+server.ts` で登録する。主要エンドポイントの `/rss` は RSS フィード。記事登録は `packages/ingest` の Micropub 経由。

### Path Alias

web の `@/*` は `packages/web/` 基準（`tsconfig.json` と `vite.config.ts`）。

### Database Schema

| Table           | Fields / purpose                                                                          |
| --------------- | ----------------------------------------------------------------------------------------- |
| `page`          | Scrapbox / Micropub ページ (id, title, created, updated, image, sbID, spoiler)            |
| `article`       | 登録済み記事 (id, pageID, created, date)                                                  |
| `excluded_page` | 除外ページ (id, pageID, created)                                                          |
| `clip`          | clip (id, pageID, created, kind)                                                          |
| `zet`           | diary の日々の断片 (id, pageID, rkey, date, title, created)                               |
| `druck`         | HTML 記事 (AI が作ったもの) (id, pageID, date, created)                                   |
| `draft`         | 公開前の article (id, key, title, bodyKey, spoiler, mf2, created, updated)。page と無関係 |

`page.spoiler` は diary が付けるネタバレの印 (article は Micropub の `spoiler` property、zet は record の `spoiler`)。立っている page は Bluesky / Threads / ActivityPub に題と URL だけを出し、Webmention を送らない。`page.image` (一覧のサムネと OG 画像) は伏せず、普段どおり本文の先頭画像を持つ (アイキャッチにネタバレになる画像を置かない運用)。web は記事ページの本文を HTML に描いたまま hidden で隠し、「表示する」を押すと見せる (bot には読ませる)。zets 一覧・検索・RSS・og:description で抜粋を伏せる。

zet の本体は PDS (ds.jgs.me) の `me.jgs.diary.zet` record。`page.title` は内部用の `zet:<rkey>`、公開 URL は `/pages/zet%3A<rkey>`。表示名は `@jigsaw/db/zet` の `pageDisplayTitle` を使う。at-uri と CID は `copy` (protocol = `atproto-zet`) に置く。

HTML 記事 (druck) の本体は PDS の `site.standard.document` record (content は `me.jgs.diary.html`、diary がサニタイズ済み)。Micropub に `category: ["document"]` と at-uri を送って取り込む。題が既存 page と衝突したら 409。at-uri と CID は `copy` (protocol = `atproto-document`)。`page_link` は持たず、Micropub の update と `q=source` は受けない。

| bodyKey / R2 object | 中身                                                    |
| ------------------- | ------------------------------------------------------- |
| `html-<uuid>`       | bodyKey (standard-html 形式)                            |
| `<key>.html`        | 原本 (diary がサニタイズ済み)                           |
| `<key>.render.json` | ingest が表示用に組み直したもの (`RenderedHtmlArticle`) |
| `<key>.sb`          | 派生テキスト                                            |
| w-md の `<key>.md`  | 検索インデックス用                                      |

`RENDER_VERSION` (`@jigsaw/db/html-article`) は render.json に残すラベルで、読んで分岐する所は無い。組み直しの規則を変えても、既存の記事には自動で効かない。diary から record を書き直して CID を変えて再 publish した記事だけが新しい規則で組み直される (同じ CID の再送は何もしない)。

publication record は `at://did:web:ds.jgs.me/site.standard.publication/3mz7iuy6k2222`。`pnpm standard-publication` で 1 回だけ書き、web が `/.well-known/site.standard.publication` でその at-uri を返す。

#### HTML article を出す順

1. **merge より前に**、main ではなくこの branch の worktree の `packages/ingest` から druck 表を当てる (merge で deploy された新しいコードが無い表を引いて落ちるため)。先に `npx wrangler d1 migrations list w --remote` で未適用を確認し、`npx wrangler d1 migrations apply w --remote` で当てる
2. jgs.me を merge して deploy (Workers Builds が w / w-ingest / w-ap を出す)
3. `PDS_IDENTIFIER=… PDS_PASSWORD=… pnpm standard-publication` を 1 回打つ
4. `curl -s https://w.jgs.me/.well-known/site.standard.publication` が同じ at-uri を返すのを確かめる
5. そのあとで diary 側を出す

### draft (公開前の確認)

外部のメディアチェックなど、公開前に実際の見た目で読んでもらうための仕組み。URL (`https://w.jgs.me/drafts/<鍵>`) を知っている人だけが読める。対象は Micropub の article だけ (clip / zet / document は 400)。

**draft は `page` 行も `article` 行も持たない。** `/pages/<title>`・suggest・`/p/:id`・OG 画像・検索・RSS・トップ・ActivityPub などの既存の読み出しに「draft を除く」条件を足さない。draft に flag を付けて `page` に入れる変更もしない（条件の足し忘れがそのまま公開事故になるため）。

`draft.key` は `newDraftKey` (`@jigsaw/db/draft`) が作る 256 bit の乱数 (base64url 43 文字) で、平文で持つ。`title` に unique は無い。本文は 1 行目が題の `.sb` を R2 に置き、w-md・`page_link`・`object` は作らない。実装は `packages/ingest/src/draft.ts` (手順) と `draftStore.ts` (D1 / R2 / 配信)。`post-status` の読み取りは `postStatus.ts`、`/drafts/<鍵>` の URL は `target.ts` の `parseTargetURL` が `kind: "draft"` で返す。

#### Micropub の契約 (`post-status`)

| 操作         | リクエスト                                                                             | 応答                                          |
| ------------ | -------------------------------------------------------------------------------------- | --------------------------------------------- |
| draft を作る | 普段の create の `properties` に `post-status: ["draft"]`                              | 201、`Location: https://w.jgs.me/drafts/<鍵>` |
| draft を直す | `action: "update"`、`url` は `/drafts/<鍵>`、`replace` などは普段の update と同じ      | 204。鍵も URL も変わらない                    |
| 公開する     | `action: "update"`、`url` は `/drafts/<鍵>`、`replace: {"post-status": ["published"]}` | 201、`Location: https://w.jgs.me/pages/<題>`  |

- `post-status` が無い create / update は今までどおり。`published` の create は普段の create。`draft` / `published` 以外の値は 400（黙って公開に倒さない）
- draft の create / update は AP / Bluesky / Threads / Webmention・w-md・purge を呼ばない。`mp-silent` は無視する
- 公開する update に `mp-silent` が付いていたら、公開（page / article / object / page_link / w-md、201 + Location）は通常どおり行い、AP publish（`notify`）だけ呼ばない
- update は保存してある `mf2` に `applyUpdate` を当て、`parseEntry` で検証し直す。鍵に合う行が無ければ 404（公開済みかもしれない）
- 公開は draft 行の内容をそのまま公開する。題が既存の page と衝突したら **409 で何も変えない**（create の `uniqueTitle` のように ` (1)` は付けない。チェック済みの題と違う題で出さないため）
- 公開で `page` / `article` / `object` (`mf2` から `post-status` を落とす) / `page_link` を 1 つの D1 batch で入れて draft 行を消す。途中で落ちても「page ができて draft も残る」状態にならない。そのあと w-md と AP publish (`kind: "create"`) を呼ぶ。この 2 つは best-effort で、落ちても 201 を返す
- `page.created` と `article.date` (`jstDate`) は**公開した時刻**。draft を作った時刻ではない
- 公開でも `purge` は呼ばない（普段の create と同じ）
- 公開済みの page を draft に戻せない。page への update に `post-status: draft` を付けると 400
- `/drafts/<鍵>` の URL は `q=source` で受けない

#### 守れないもの

本文に貼った画像と xhtm の部品は w-media に入り、URL を知っていれば誰でも読める。URL は推測できない形 (ハッシュ) だが、鍵では守られない。draft を消す・鍵を作り直す・期限を付ける機能は無く、出さない draft は残ったままになる。

#### draft の機能を出す順

1. **merge より前に**、この branch の worktree の `packages/ingest` から `draft` 表の migration (0020) を当てる (merge で deploy された新しいコードが無い表を引いて落ちるため)。先に `npx wrangler d1 migrations list w --remote` で未適用を確認し、`npx wrangler d1 migrations apply w --remote` で当てる
2. jgs.me を merge して deploy
3. そのあとで diary 側を出す

### Environment Variables

1. `DB` — D1 binding
2. `R2` — R2 binding
3. `SITE_URL` — サイト URL

## Development Conventions

1. **Code Style:** Prettier を使い、commit 前に必ず `pnpm format` を実行する。
2. **Commit Tracing:** 意味のある作業単位で commit し、履歴を追えるようにする。
3. **Approval Flow:** 計画に対するユーザーの明示承認前に実装を始めない。spec / plan は repo に commit せず、rill の `jgs.me` project に `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` / `docs/superpowers/plans/YYYY-MM-DD-<topic>.md` として保存する。

## Version Control Workflow

**main に直接 push しない。必ず Pull Request を使う。push と merge はそれぞれユーザー承認を待つ。**

1. 最新の `origin/main` から branch を作る。
   ```bash
   git fetch origin
   git switch -c feat/your-feature-name origin/main
   ```
   隔離が必要なら、作業開始時の cwd を基準に `.worktrees/<branch-slug>` を使う。作成前に `.worktrees/` が Git の ignore 対象か確認する。
   ```bash
   git worktree add .worktrees/your-feature-name -b feat/your-feature-name origin/main
   ```
2. 変更し、format 後に commit する。
   ```bash
   pnpm format
   git commit -m "feat: description of changes"
   ```
3. ユーザー承認後に push する。
   ```bash
   git push -u origin feat/your-feature-name
   ```
4. `gh` CLI で main 向けの Pull Request を作る。
   ```bash
   gh pr create --base main
   ```
5. ユーザー承認後に GitHub で merge する。
6. main に戻り、merge 済みの変更を取得する。
   ```bash
   git switch main && git pull
   ```
