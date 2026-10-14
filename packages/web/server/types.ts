export type Bindings = {
  DB: D1Database;
  R2: R2Bucket;
  AI: Ai;
  AP: Fetcher;
  // デプロイごとに変わる id を持つ。HTML のキャッシュキーに混ぜて、
  // 古いアセットを指す HTML が配られ続けるのを防ぐ (server/cacheKey.ts)。
  CF_VERSION_METADATA: WorkerVersionMetadata;
  // POST /internal/purge の共有シークレット (secret)。
  // w.jgs.me は公開ドメインなので、このパスも外から到達する。
  PURGE_TOKEN: string;
};
