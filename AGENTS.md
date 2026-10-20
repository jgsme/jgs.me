# Project jgs.me

このファイルは、このリポジトリで作業するエージェント共通の指示とプロジェクト情報をまとめる。package 固有の指示は各 `packages/*/AGENTS.md` を参照する。

## Project Overview

`jgs.me` は記事・clip・zet を管理・公開する個人サイト。Scrapbox 同期は 2026 年 8 月に廃止され、export archive は凍結済み。新規ページは Micropub (`packages/ingest`) 経由で取り込む。

pnpm workspaces のモノレポで、Cloudflare Workers / D1 / R2 を使用する。Web は Vike + React + Hono、スタイルは Tailwind CSS、DB は Drizzle ORM、テストは Vitest。

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
pnpm undo <url|id> [<url|id>...] # 登録を取り消す（article/clip/excluded_page と w-md から削除）
pnpm kind <url|id> <kind>       # clip.kind を変更 (link/quote/photo/video)
pnpm kind --csv <path>         # CSV から一括変更
pnpm md-backfill               # 検索インデックス用の md (w-md) を既存ページぶん埋める
pnpm zet-rehost                # 取り込み済み zet の画像を PDS の blob から w-media に写す
pnpm clip-margin [--dry-run|--delete] # clip を Margin の at.margin.note として PDS に書き、clips コレクションに入れる。--delete は消す
```

## Architecture

### Packages

| Package           | Description                                                                         |
| ----------------- | ----------------------------------------------------------------------------------- |
| `packages/db`     | 共有 Drizzle スキーマ（`@jigsaw/db` としてインポート）                              |
| `packages/web`    | メインの Web UI / API（Vike + React + Hono、Cloudflare Workers / Universal Deploy） |
| `packages/theme`  | design token（Tailwind v4 の `@theme`。`packages/web` が import する）              |
| `packages/og`     | OG 画像生成 Worker（Satori + Resvg）                                                |
| `packages/home`   | ホームページ用 Worker                                                               |
| `packages/cli`    | undo、kind、md-backfill、zet-rehost などの CLI                                      |
| `packages/ingest` | Micropub 経由の取り込み、D1 migration の実行元                                      |

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
3. `/a/{id}` — `/pages/{title}` への共有 URL リダイレクト。clip は `/c/{id}`、zet は `/z/{zet.id}`。実体は `server/routes/redirects.ts`、形式は `utils/permalink.ts`。7 日 edge cache、ingest が update 時に purge する。
4. `pages/search/` — 検索。
5. `pages/clips/` — clip 一覧。
6. `pages/zets/` — zet 一覧（`zet.date` 降順、`?p=N`）。個別は専用ページを持たず、記事と同じ `pages/article/@title/` が `/pages/zet%3A<rkey>` で表示する。見出しと `<title>` は `zet.title`、無ければ `zet.date`。`zet:<rkey>` は表示しない。
7. `pages/on-this-day/@mmdd/` — 周年日記（`/on-this-day/@mmdd`）。`article.date` の月日が一致する記事を年ごとにグルーピングする。

zet 本文も R2 の `.sb`。画像は取り込み時に PDS の blob を w-media に写し、Image Transformations 用に r2.jgs.me の URL に差し替える。写せなかった blob だけ getBlob URL に `#.png` を付けて画像として読み込み、`pnpm zet-rehost` で後から拾う。

### API Routes

Hono ハンドラは `packages/web/server/routes/` に配置し、`+server.ts` で登録する。主要エンドポイントの `/rss` は RSS フィード。記事登録は `packages/ingest` の Micropub 経由。

### Path Alias

web の `@/*` は `packages/web/` 基準（`tsconfig.json` と `vite.config.ts`）。

### Database Schema

| Table           | Fields / purpose                                                      |
| --------------- | --------------------------------------------------------------------- |
| `page`          | Scrapbox / Micropub ページ (id, title, created, updated, image, sbID) |
| `article`       | 登録済み記事 (id, pageID, created, date)                              |
| `excluded_page` | 除外ページ (id, pageID, created)                                      |
| `clip`          | clip (id, pageID, created, kind)                                      |
| `zet`           | diary の日々の断片 (id, pageID, rkey, date, title, created)           |

zet の本体は PDS (ds.jgs.me) の `me.jgs.diary.zet` record。`page.title` は内部用の `zet:<rkey>`、公開 URL は `/pages/zet%3A<rkey>`。表示名は `@jigsaw/db/zet` の `pageDisplayTitle` を使う。at-uri と CID は `copy` (protocol = `atproto-zet`) に置く。

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
