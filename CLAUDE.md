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

Vike + React + Hono で構成された Cloudflare Pages アプリケーション。

### Entry Points
- `hono-entry.ts` - Hono サーバーエントリポイント。API ルートと Vike ハンドラを統合
- `server/vike-handler.ts` - Vike の SSR レンダリングを Cloudflare Workers Response に変換

### Database
- Cloudflare D1 (SQLite) + Drizzle ORM
- スキーマ: `db/schema.ts`
- D1バインディング: `DB` (wrangler.toml で定義)
- マイグレーション: `drizzle/` ディレクトリ

### Pages (Vike)
- ファイルベースルーティング: `pages/` 配下
- `+Page.tsx` - ページコンポーネント
- `+data.ts` - サーバーサイドデータフェッチ
- `+config.ts` - ページ設定
- レイアウト: `pages/Layout.tsx`

### API Routes
- `api/` 配下に Hono ハンドラを配置
- `hono-entry.ts` でルート登録

### Path Alias
- `@/*` → プロジェクトルートからの絶対パス (tsconfig.json + vite.config.ts)
