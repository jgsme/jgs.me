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
pnpm undo <url|id> [<url|id>...]  # Discord 通知のボタン押し間違いを取り消す（article/clip/excluded_page から削除）
```

## Architecture

pnpm ワークスペースによるモノレポ構成。

### Packages

- `packages/db` - 共有 Drizzle スキーマ（`@jigsaw/db` としてインポート）
- `packages/web` - メインのWebアプリ（Vike + React + Photon + Hono、Cloudflare Pages）
- `packages/notify` - 通知ワーカー（未登録記事を Discord にボタン付きで通知し、押下 interaction を受けて登録/クリップ/除外を実行。JST 05:00 cron）
- `packages/og` - OG画像生成ワーカー（Satori + Resvg）
- `packages/home` - ホームページ用ワーカー
- `packages/cli` - undo CLI（`pnpm undo <url|id>` で Discord ボタンの押し間違いを取り消し、article/clip/excluded_page から削除）

### Web App (packages/web)

Vike + React + Photon + Hono で構成された Cloudflare Pages アプリケーション。

### Photon

- `@photonjs/cloudflare`, `@photonjs/hono`, `@photonjs/core` を使用
- `vike-photon` で Vike と統合
- Vite プラグインとして動作し、Cloudflare Workers 向けにビルド

### Entry Points (packages/web)

- `server/index.ts` - Hono サーバーエントリポイント。`@photonjs/hono` の `apply()` と `serve()` で Vike と統合

### Database

- Cloudflare D1 (SQLite) + Drizzle ORM
- スキーマ: `packages/db/src/schema.ts`（`@jigsaw/db` でインポート）
- D1バインディング: `DB` (wrangler.jsonc で定義)
- マイグレーション: `packages/web/drizzle/` ディレクトリ

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

### API Routes

- `server/routes/` 配下に Hono ハンドラを配置
- `server/index.ts` でルート登録
- 主要エンドポイント:
  - `/rss` - RSS フィード

記事登録 / クリップ / 除外は notify ワーカーの Discord ボタン経由で行う (`packages/notify`)。

### Path Alias

- `@/*` → プロジェクトルートからの絶対パス (tsconfig.json + vite.config.ts)

### Database Schema

- `page` - Scrapbox ページ (id, title, created, updated, image, sbID)
- `article` - 登録済み記事 (id, pageID, created)
- `excluded_page` - 除外ページ (id, pageID, created)
- `clip` - クリップ (id, pageID, created)

### Environment Variables

- `DB` - D1 データベースバインディング
- `R2` - R2 バケットバインディング
- `DISCORD_APPLICATION_ID` - Discord アプリの Application ID (notify ワーカー用)
- `DISCORD_BOT_TOKEN` - Discord bot token (notify ワーカー用)
- `DISCORD_CHANNEL_ID` - 通知先チャンネル ID (notify ワーカー用)
- `DISCORD_PUBLIC_KEY` - Discord アプリの Public Key、interaction の署名検証用 (notify ワーカー用)
- `COMMAND_REGISTER_TOKEN` - slash command 登録エンドポイント (`POST /register`) の共有シークレット (notify ワーカー用)
- `SITE_URL` - サイトURL
