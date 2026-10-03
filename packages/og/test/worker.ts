// テスト専用の entry (test/wrangler.jsonc)。
// 本番と同じく wrangler で bundle して workerd で動かし、生成関数を直接呼ぶ。
import { initWasm } from "@resvg/resvg-wasm";
// @ts-expect-error wasm import
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";
import {
  generateDefaultOgImage,
  generateImageWithTitleOgImage,
  generateTitleOgImage,
} from "../src/image";

let wasmInitialized = false;

async function generate(url: URL): Promise<Uint8Array | null> {
  const title = url.searchParams.get("title") ?? "";
  switch (url.pathname) {
    case "/default":
      return generateDefaultOgImage();
    case "/title":
      return generateTitleOgImage(title);
    case "/image":
      return generateImageWithTitleOgImage(
        title,
        url.searchParams.get("src") ?? "",
      );
    default:
      return null;
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (!wasmInitialized) {
      await initWasm(resvgWasm);
      wasmInitialized = true;
    }
    try {
      const png = await generate(new URL(request.url));
      if (!png) return new Response("not found", { status: 404 });
      return new Response(png, { headers: { "Content-Type": "image/png" } });
    } catch (e) {
      // テスト側で原因が読めるように、例外をそのまま返す
      const message = e instanceof Error ? `${e.name}: ${e.message}` : `${e}`;
      return new Response(message, { status: 500 });
    }
  },
};
