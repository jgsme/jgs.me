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
```

## Architecture

pnpm ワークスペースによるモノレポ構成。

### Packages
- `packages/db` - 共有 Drizzle スキーマ（`@jigsaw/db` としてインポート）
- `packages/web` - メインのWebアプリ（Vike + React + Photon + Hono、Cloudflare Pages）
- `packages/sync` - Scrapbox同期ワーカー（Cloudflare Workflows で R2 にデータ同期）
- `packages/notify` - 通知ワーカー（未登録記事をDiscord Webhookで通知、JST 05:00 cron）
- `packages/og` - OG画像生成ワーカー（Satori + Resvg）
- `packages/home` - ホームページ用ワーカー

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
  - Scrapbox API からコンテンツ取得、`@progfay/scrapbox-parser` でパース
- `pages/a/@id/` - 共有URL用リダイレクト（`/a/{id}` → `/pages/{title}`）
- `pages/search/` - 検索ページ
- `pages/clips/` - クリップ一覧ページ

### API Routes
- `server/routes/` 配下に Hono ハンドラを配置
- `server/hono-entry.ts` でルート登録
- 主要エンドポイント:
  - `GET /api/article/register` - 記事登録（トークン認証）
  - `GET /api/article/exclude` - ページ除外（トークン認証）
  - `GET /api/article/clip` - クリップ追加（トークン認証）
  - `/rss` - RSS フィード

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
- `REGISTER_SECRET` - トークン署名用シークレット
- `DISCORD_WEBHOOK_URL` - Discord Webhook URL (notify ワーカー用)
- `SITE_URL` - サイトURL
