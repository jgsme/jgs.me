# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
pnpm dev          # Start Vite dev server with Hono/Cloudflare adapter

# Build & Deploy
pnpm build        # Build for production
pnpm preview      # Preview with wrangler pages dev
pnpm deploy       # Build and deploy to Cloudflare Pages

# Database
pnpm gen          # Generate Drizzle migrations (drizzle-kit generate)

# CLI Tools
pnpm undo <url|id> [<url|id>...]  # 登録を取り消す（article/clip/excluded_page から削除）

# Lint
pnpm lint:tokens  # design token から外れた書き方を検出する
```

## Architecture

pnpm ワークスペースによるモノレポ構成。

### Packages

- `packages/db` - 共有 Drizzle スキーマ（`@jigsaw/db` としてインポート）
- `packages/web` - メインのWebアプリ（Vike + React + Hono、Cloudflare Workers / Universal Deploy）
- `packages/theme` - design token（Tailwind v4 の `@theme`。`packages/web` が import する）
- `packages/og` - OG画像生成ワーカー（Satori + Resvg）
- `packages/home` - ホームページ用ワーカー
- `packages/cli` - undo CLI（`pnpm undo <url|id>` で登録を取り消し、article/clip/excluded_page から削除）

### Web App (packages/web)

Vike + React + Hono で構成された Cloudflare Workers アプリケーション (Vike の Universal Deploy)。

### Universal Deploy (@vikejs/hono)

- `@vikejs/hono` と `@cloudflare/vite-plugin` を使用
- Vite プラグインとして動作し、Cloudflare Workers 向けにビルド (ビルド成果物に `dist/w` が生成され、これが実デプロイ単位)

### Entry Points (packages/web)

- `+server.ts` - Hono サーバーエントリポイント。`@vikejs/hono` の `vike()` で Vike と統合し、`export default { fetch: app.fetch } satisfies Server` で公開する

### Database

- Cloudflare D1 (SQLite) + Drizzle ORM
- スキーマ: `packages/db/src/schema.ts`（`@jigsaw/db` でインポート）
- D1バインディング: `DB` (wrangler.jsonc で定義)
- マイグレーション: `packages/db/drizzle/` ディレクトリ

### Pages (Vike)

- ファイルベースルーティング: `pages/` 配下
- `+Page.tsx` - ページコンポーネント
- `+data.ts` - サーバーサイドデータフェッチ
- `+config.ts` - ページ設定
- `+route.ts` - カスタムルート定義
- レイアウト: `pages/Layout.tsx`

### Page Structure

- `pages/index/` - 記事一覧ページ（ページネーション対応、`?p=N`）
- `pages/article/@title/` - 記事詳細ページ（ルート: `/pages/@title`）
  - R2 からコンテンツ取得、`@progfay/scrapbox-parser` でパース。本文の形式は2つ
    (Scrapbox アーカイブ由来の `<scrapbox-id>.json`、Micropub (diary) 由来の
    `<sb-uuid>.sb`。どちらも1行目が題)
  - Scrapbox 同期は廃止済みで `.json` は増えないが、Micropub 経由 (`packages/ingest`)
    でページ自体は増え続ける
- `pages/a/@id/` - 共有URL用リダイレクト（`/a/{id}` → `/pages/{title}`）
- `pages/search/` - 検索ページ
- `pages/clips/` - クリップ一覧ページ
- `pages/on-this-day/@mmdd/` - 周年日記ページ（ルート: `/on-this-day/@mmdd`）。`article.date` の月日が一致する記事を年ごとにグルーピングして表示

### API Routes

- `server/routes/` 配下に Hono ハンドラを配置
- `+server.ts` でルート登録
- 主要エンドポイント:
  - `/rss` - RSS フィード

記事登録は Micropub 経由で行う (`packages/ingest`)。

### Path Alias

- `@/*` → プロジェクトルートからの絶対パス (tsconfig.json + vite.config.ts)

### Database Schema

- `page` - Scrapbox ページ (id, title, created, updated, image, sbID)
- `article` - 登録済み記事 (id, pageID, created, date)
- `excluded_page` - 除外ページ (id, pageID, created)
- `clip` - クリップ (id, pageID, created)

### Environment Variables

- `DB` - D1 データベースバインディング
- `R2` - R2 バケットバインディング
- `SITE_URL` - サイトURL
