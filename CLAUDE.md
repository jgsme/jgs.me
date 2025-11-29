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

Vike + React + Photon + Hono で構成された Cloudflare Pages アプリケーション。

### Photon
- `@photonjs/cloudflare`, `@photonjs/hono`, `@photonjs/core` を使用
- `vike-photon` で Vike と統合
- Vite プラグインとして動作し、Cloudflare Workers 向けにビルド

### Entry Points
- `server/index.ts` - Hono サーバーエントリポイント。`@photonjs/hono` の `apply()` と `serve()` で Vike と統合

### Database
- Cloudflare D1 (SQLite) + Drizzle ORM
- スキーマ: `db/schema.ts`
- D1バインディング: `DB` (wrangler.jsonc で定義)
- マイグレーション: `drizzle/` ディレクトリ

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

### API Routes
- `api/` 配下に Hono ハンドラを配置
- `hono-entry.ts` でルート登録

### Path Alias
- `@/*` → プロジェクトルートからの絶対パス (tsconfig.json + vite.config.ts)
