# On This Day データ構造化計画

## 概要

「On This Day」（`0101`〜`1231`のようなタイトルの Scrapbox ページ）の内部構造（年ごとの記事リンク）をパースし、構造化データとしてデータベースに保存する。記事リンクは DB 内の既存ページへのリレーションとして保持する。効率化のため、既存の同期処理と同様に直近（過去 25 時間程度）に更新されたページのみを対象とする。

## 0. 前準備 (マイグレーション管理の移行)

データベースの責務を明確にするため、マイグレーション管理を `packages/web` から `packages/db` に移動する。

1.  `drizzle-kit` を `packages/db` にインストール。
2.  `drizzle.config.ts` を `packages/web` から `packages/db` に移動し、パスを修正。
3.  既存のマイグレーションファイル (`packages/web/drizzle/`) を `packages/db/drizzle/` に移動。
4.  各パッケージ (`web`, `sync`, `home` 等) の `wrangler.jsonc` における `migrations_dir` のパスを修正する（例: `../db/drizzle`）。

## 1. データベーススキーマ

`packages/db/src/schema.ts` に `onThisDayEntries` テーブルを追加する。
`pages` テーブルへのリレーションは `onThisDayEntries` 側からの一方向のみ定義し、既存の `pages` 定義には極力触れない方針とする。

### `onThisDayEntries`

```typescript
export const onThisDayEntries = sqliteTable("on_this_day_entry", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  pageID: integer("pageID")
    .notNull()
    .references(() => pages.id), // 親ページ (例: 0401) への参照
  targetPageID: integer("targetPageID")
    .notNull()
    .references(() => pages.id), // 実際の記事ページへの参照
  year: integer("year").notNull(), // 記事の年 (例: 2022)
  created: text("created")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updated: text("updated")
    .notNull()
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

// リレーション定義 (Drizzle ORM)
export const onThisDayEntryRelations = relations(
  onThisDayEntries,
  ({ one }) => ({
    page: one(pages, {
      // 親ページ
      fields: [onThisDayEntries.pageID],
      references: [pages.id],
    }),
    targetPage: one(pages, {
      // 記事ページ
      fields: [onThisDayEntries.targetPageID],
      references: [pages.id],
    }),
  }),
);
```

## 2. バッチ処理 (独立した Workflow)

既存の同期処理とは分離し、新しい Workflow (`OnThisDayWorkflow`) を作成する。

- **トリガー**: `SyncWorkflow` の完了後に呼び出される（Chain 実行）。
- **引数 (`OnThisDayParams`)**:
  - `cutoff`: この時刻以降に更新されたページを対象とする（デフォルトは実行時の 25 時間前）。
- **処理フロー (`OnThisDayWorkflow`)**:
  1.  `pages` テーブルから、タイトルが `^\d{4}$` (MMDD 形式) かつ、`updated` が `cutoff` より新しいページ一覧を取得する。
  2.  各対象ページについて以下を実行:
      a. R2 または DB からページの最新テキストデータを取得する。
      b. テキストをパースし、`[YYYY]` セクションと配下の記事リンクを抽出する。
      c. 抽出したリンクタイトルから `pages` テーブルを検索し、`targetPageID` を解決する。
      d. `onThisDayEntries` テーブルに対し、該当 `pageID` の既存データを削除し、新しいデータを挿入する（洗い替え）。

## 3. 実装手順

1.  **マイグレーション移行**: 前準備の手順に従い、マイグレーション環境を `packages/db` に集約。
2.  **スキーマ定義**: `packages/db` でテーブル定義 (`onThisDayEntries`) を追加。
3.  **マイグレーション生成**: `packages/db` で `gen` コマンドを実行。
4.  **Workflow 実装**: `packages/sync` に新しい Workflow クラスを追加し、パース・DB 保存ロジックを実装。
5.  **Workflow 連携**: `SyncWorkflow` の完了時に新しい Workflow をトリガーするように修正。
6.  **テスト**: ローカルで実行し、指定した `cutoff` に基づいて更新が行われるか確認。
