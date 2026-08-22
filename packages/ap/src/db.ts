import { drizzle } from "drizzle-orm/d1";

export function getDB(d1: D1Database) {
  return drizzle(d1);
}

export type DeliveryMessage = {
  inbox: string;
  activity: unknown;
};

export type WebmentionMessage = {
  source: string;
  target: string;
};

export type SendMessage = {
  // 言及している側のページ。h-entry を持つ /pages/<title> を入れる。
  source: string;
  target: string;
};

export type BskyMessage = {
  pageID: number;
};

export type Env = {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  DELIVERY: Queue<DeliveryMessage>;
  WEBMENTION: Queue<WebmentionMessage>;
  WM_SEND: Queue<SendMessage>;
  BSKY: Queue<BskyMessage>;
  AP_PRIVATE_KEY: string;
  AP_PUBLIC_KEY: string;
  // 空文字なら通知しない。設定漏れでリクエストが失敗し続けるのを避ける。
  DISCORD_REACTION_WEBHOOK: string;
  BSKY_HANDLE: string;
  BSKY_APP_PASSWORD: string;
};
