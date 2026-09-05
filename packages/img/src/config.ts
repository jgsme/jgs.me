// 個別ページのホスト。シェアされる URL はここ。
export const SITE_URL = "https://i.jgs.me";

// 画像の実体。R2 バケット w-media の custom domain。
export const MEDIA_BASE_URL = "https://r2.jgs.me";

// アップロードの上限。putMedia は ArrayBuffer を丸ごとメモリに載せるので、
// Workers の 128MB 制限に対して無防備なまま受けない。
// ap の MAX_IMAGE_BYTES (2MB) とは別物 — あちらは外部サイトから取りに行く
// アバターや og:image で、こちらは自分が意図して上げる画像。
export const MAX_UPLOAD_BYTES = 20_000_000;
