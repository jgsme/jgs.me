import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestHarness,
  unstable_readConfig,
  type TestHarness,
} from "wrangler";

// src/image.tsx の生成関数を workerd 上で実際に呼ぶ回帰テスト。
// Node / Bun で直接呼ぶと、workerd に無いグローバル (self.location など) を
// 踏む依存の壊れ方が再現しない (satori 0.33 の harfbuzzjs がそれだった)。

const fixturesDir = new URL("./fixtures/", import.meta.url);

let harness: TestHarness;
let fixtureServer: Server;
let fixtureOrigin: string;

beforeAll(async () => {
  // 画像付きの生成関数は URL から画像を fetch するので、fixture を配る
  fixtureServer = createServer(async (req, res) => {
    try {
      const body = await readFile(new URL(`.${req.url}`, fixturesDir));
      res.writeHead(200).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) =>
    fixtureServer.listen(0, "127.0.0.1", resolve),
  );
  const { port } = fixtureServer.address() as AddressInfo;
  fixtureOrigin = `http://127.0.0.1:${port}`;

  harness = createTestHarness({
    workers: [{ configPath: new URL("./wrangler.jsonc", import.meta.url) }],
  });
  await harness.listen();
});

afterAll(async () => {
  await harness?.close();
  await new Promise((resolve) => fixtureServer?.close(resolve));
});

async function fetchPng(path: string): Promise<Uint8Array> {
  const res = await harness.fetch(path);
  // 失敗時は worker が返した例外メッセージをそのまま見せる
  expect(res.status, await res.clone().text()).toBe(200);
  expect(res.headers.get("Content-Type")).toBe("image/png");
  return new Uint8Array(await res.arrayBuffer());
}

function expectOgPng(bytes: Uint8Array): PNG {
  const png = PNG.sync.read(Buffer.from(bytes));
  expect({ width: png.width, height: png.height }).toEqual({
    width: 1200,
    height: 630,
  });
  return png;
}

// 背景色 (src/image.tsx の BG_COLOR)
const BG = [0x82, 0x22, 0x1c];

// 画像を描けずに空白のまま PNG が出来上がるケースがある (resvg が読めない形式を
// 渡したときなど) ので、画像が置かれるはずの位置の色を見る
function expectImageDrawnAt(png: PNG, x: number, y: number) {
  const i = (png.width * y + x) * 4;
  const pixel = [...png.data.subarray(i, i + 3)];
  expect(pixel, `(${x}, ${y}) が背景色のまま`).not.toEqual(BG);
}

const imagePath = (title: string, fixture: string) =>
  `/image?${new URLSearchParams({ title, src: `${fixtureOrigin}/${fixture}` })}`;

it("テスト用 worker の実行環境が本番と揃っている", () => {
  const read = (path: string) => {
    const config = unstable_readConfig({
      config: new URL(path, import.meta.url).pathname,
    });
    return {
      compatibility_date: config.compatibility_date,
      compatibility_flags: config.compatibility_flags,
    };
  };
  expect(read("./wrangler.jsonc")).toEqual(read("../wrangler.jsonc"));
});

describe("generateDefaultOgImage", () => {
  it("1200x630 の PNG を返す", async () => {
    expectOgPng(await fetchPng("/default"));
  });
});

describe("generateTitleOgImage", () => {
  it.each([
    ["短い題", "日記"],
    ["長い題", "とても長いタイトル".repeat(10)],
  ])("%s", async (_, title) => {
    expectOgPng(await fetchPng(`/title?${new URLSearchParams({ title })}`));
  });
});

// 横長は上部中央、縦長は左端に画像が置かれる
const LANDSCAPE_IMAGE_AT = [600, 195] as const;
const PORTRAIT_IMAGE_AT = [150, 315] as const;

describe("generateImageWithTitleOgImage", () => {
  it.each([
    ["jpg (横長)", "landscape.jpg", LANDSCAPE_IMAGE_AT],
    ["png (縦長)", "portrait.png", PORTRAIT_IMAGE_AT],
  ])("%s", async (_, fixture, [x, y]) => {
    const png = expectOgPng(await fetchPng(imagePath("写真の題", fixture)));
    expectImageDrawnAt(png, x, y);
  });

  // 既知の失敗。satori 0.26 は data URI の画像サイズを PNG / GIF / JPEG しか
  // 読めず、webp だと `u2 is not iterable` で落ちる。satori を通しても
  // @resvg/resvg-wasm 2.6.2 が webp をデコードできず空白になる。
  // 直ったら it.fails が落ちるので it に戻す
  it.fails.each([
    ["webp VP8 (横長)", "landscape.webp", LANDSCAPE_IMAGE_AT],
    ["webp VP8L (横長)", "landscape-lossless.webp", LANDSCAPE_IMAGE_AT],
  ])("%s", async (_, fixture, [x, y]) => {
    const png = expectOgPng(await fetchPng(imagePath("写真の題", fixture)));
    expectImageDrawnAt(png, x, y);
  });
});
