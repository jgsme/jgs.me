import { Hono } from "hono";
import satori from "satori";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";
// @ts-expect-error wasm import
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";
import { getDB } from "./db";
import { pages } from "@jigsaw/db";
import { eq } from "drizzle-orm";

type Bindings = {
  DB: D1Database;
  R2: R2Bucket;
  OG: R2Bucket;
  ENVIRONMENT: string;
};

type RegenerateParams = {
  pageId: number;
};

const app = new Hono<{ Bindings: Bindings }>();

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const BG_COLOR = "#82221c";

let wasmInitialized = false;

async function ensureWasmInitialized() {
  if (!wasmInitialized) {
    await initWasm(resvgWasm);
    wasmInitialized = true;
  }
}

async function loadFont(): Promise<ArrayBuffer> {
  const res = await fetch(
    "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-jp@latest/japanese-700-normal.woff"
  );
  return res.arrayBuffer();
}

const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 115.17 108.76" fill="#efefef">
  <path d="M50.61,40.08H87.34L75.63,50.85l-.11,48-10.4,9.91,0-33.23-15.57,0L49.5,98.85l-10.68,9.91v-58M49.58,64.8l15.57,0v-14H49.58Z"/>
  <polyline points="9.49 15.33 0 0 58.42 21.78 115.17 0 105.32 15.33 67.84 28.21 113.21 28.3 103.13 39.05 0.38 38.97 9.03 28.15 48.54 27.49"/>
  <polyline points="100.58 76.31 76.65 76.31 76.65 51.53 89.12 40.08 89.12 65.6 104.04 65.6 104.41 39.55 115.17 28.3 115.17 75.75 80.92 108.76 66.82 108.76"/>
  <polygon points="17.71 98.85 17.71 50.84 9.03 50.84 0.38 40.08 48.54 40.08 37.19 50.84 28.42 50.84 28.42 108.76 17.71 98.85"/>
</svg>`;

const markDataUri = `data:image/svg+xml,${encodeURIComponent(markSvg)}`;

type ImageInfo = {
  dataUri: string;
  width: number;
  height: number;
};

async function fetchImageAsDataUri(url: string): Promise<ImageInfo> {
  const res = await fetch(url, { redirect: "follow" });
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  let width = 0;
  let height = 0;
  let mimeType = "image/png";

  // PNG check (signature: 0x89504E47)
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    const view = new DataView(buffer);
    width = view.getUint32(16);
    height = view.getUint32(20);
    mimeType = "image/png";
  }
  // JPEG check (signature: 0xFFD8)
  else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    mimeType = "image/jpeg";
    // Find SOF marker to get dimensions
    let offset = 2;
    while (offset < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = bytes[offset + 1];
      // SOF0-SOF2 markers contain image dimensions
      if (marker >= 0xc0 && marker <= 0xc2) {
        height = (bytes[offset + 5] << 8) | bytes[offset + 6];
        width = (bytes[offset + 7] << 8) | bytes[offset + 8];
        break;
      }
      // Skip to next marker
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      offset += 2 + length;
    }
  }
  // WebP check
  else if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  ) {
    mimeType = "image/webp";
    // Simple WebP VP8 parsing
    if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38) {
      // VP8
      if (bytes[15] === 0x20) {
        width = ((bytes[26] | (bytes[27] << 8)) & 0x3fff);
        height = ((bytes[28] | (bytes[29] << 8)) & 0x3fff);
      }
      // VP8L
      else if (bytes[15] === 0x4c) {
        const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
        width = (bits & 0x3fff) + 1;
        height = ((bits >> 14) & 0x3fff) + 1;
      }
    }
  }

  // Convert to base64
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  const dataUri = `data:${mimeType};base64,${base64}`;

  return { dataUri, width, height };
}

async function generateDefaultOgImage(): Promise<Uint8Array> {
  await ensureWasmInitialized();
  const font = await loadFont();

  const element = (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: BG_COLOR,
      }}
    >
      <img src={markDataUri} width={300} height={283} />
    </div>
  );

  const svg = await satori(element, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: [
      {
        name: "Noto Sans JP",
        data: font,
        weight: 700,
        style: "normal",
      },
    ],
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: OG_WIDTH },
  });
  return resvg.render().asPng();
}

async function generateTitleOgImage(title: string): Promise<Uint8Array> {
  await ensureWasmInitialized();
  const font = await loadFont();

  const fontSize = title.length > 30 ? 48 : 64;

  // OG_WIDTH=1200, OG_HEIGHT=630
  // 上左右: 32px, カード: 1136 x 500, 下: マーク用スペース 98px
  const cardWidth = OG_WIDTH - 32 * 2; // 1136
  const cardHeight = 500;

  const element = (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        backgroundColor: BG_COLOR,
        padding: "32px 32px 0 32px",
      }}
    >
      <div
        style={{
          width: `${cardWidth}px`,
          height: `${cardHeight}px`,
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 60px",
        }}
      >
        <div
          style={{
            color: "#1a1a1a",
            fontSize,
            fontWeight: 700,
            textAlign: "center",
            lineHeight: 1.4,
            wordBreak: "break-word",
          }}
        >
          {title}
        </div>
      </div>
      <img
        src={markDataUri}
        width={60}
        height={57}
        style={{ marginTop: "20px" }}
      />
    </div>
  );

  const svg = await satori(element, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: [
      {
        name: "Noto Sans JP",
        data: font,
        weight: 700,
        style: "normal",
      },
    ],
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: OG_WIDTH },
  });
  return resvg.render().asPng();
}

async function generateImageWithTitleOgImage(
  title: string,
  imageUrl: string
): Promise<Uint8Array> {
  await ensureWasmInitialized();
  const font = await loadFont();

  const imageInfo = await fetchImageAsDataUri(imageUrl);
  const isLandscape = imageInfo.width > imageInfo.height;

  let element: React.ReactNode;

  if (!isLandscape) {
    // 縦長・正方形画像: 左に画像(630pxフルハイト、白枠の外)、右に白枠(タイトル)+マーク
    const fontSize = title.length > 20 ? 36 : 44;

    // 画像サイズの決定: 高さは630pxフル、幅は比率維持
    // 拡大はしない、縮小のみ
    let displayWidth = imageInfo.width;
    let displayHeight = imageInfo.height;

    // 高さをOG_HEIGHTに合わせる（縮小のみ）
    if (displayHeight > OG_HEIGHT) {
      const scale = OG_HEIGHT / displayHeight;
      displayHeight = OG_HEIGHT;
      displayWidth = Math.round(imageInfo.width * scale);
    }
    // 幅の最大はOG_WIDTHの50%（右側に白枠を配置するため）
    const maxWidth = Math.round(OG_WIDTH * 0.5);
    if (displayWidth > maxWidth) {
      const scale = maxWidth / displayWidth;
      displayWidth = maxWidth;
      displayHeight = Math.round(displayHeight * scale);
    }

    element = (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: BG_COLOR,
        }}
      >
        {/* 左側: 画像 (630pxフルハイト、白枠の外) */}
        <div
          style={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <img
            src={imageInfo.dataUri}
            style={{
              width: `${displayWidth}px`,
              height: `${displayHeight}px`,
              objectFit: "contain",
            }}
          />
        </div>
        {/* 右側: 白枠(タイトル) + マーク(白枠の外) */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "32px",
          }}
        >
          {/* 白枠: タイトルのみ */}
          <div
            style={{
              width: "100%",
              flex: 1,
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px",
            }}
          >
            <div
              style={{
                color: "#1a1a1a",
                fontSize,
                fontWeight: 700,
                textAlign: "center",
                lineHeight: 1.4,
                wordBreak: "break-word",
              }}
            >
              {title}
            </div>
          </div>
          {/* マーク: 白枠の外 */}
          <img
            src={markDataUri}
            width={60}
            height={57}
            style={{ marginTop: "20px" }}
          />
        </div>
      </div>
    );
  } else {
    // 横長画像: 縦スタック（画像 → 白枠タイトル → マーク）
    const fontSize = title.length > 30 ? 28 : 36;

    // 画像サイズの決定: 幅はOG_WIDTH、高さは比率維持（縮小のみ）
    let displayWidth = imageInfo.width;
    let displayHeight = imageInfo.height;

    // 幅をOG_WIDTHに合わせる（縮小のみ）
    if (displayWidth > OG_WIDTH) {
      const scale = OG_WIDTH / displayWidth;
      displayWidth = OG_WIDTH;
      displayHeight = Math.round(imageInfo.height * scale);
    }
    // 高さの最大は350px（タイトルとマークのスペースを確保）
    const maxHeight = 350;
    if (displayHeight > maxHeight) {
      const scale = maxHeight / displayHeight;
      displayHeight = maxHeight;
      displayWidth = Math.round(displayWidth * scale);
    }

    element = (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          backgroundColor: BG_COLOR,
          paddingTop: "20px",
        }}
      >
        {/* 画像 */}
        <img
          src={imageInfo.dataUri}
          style={{
            width: `${displayWidth}px`,
            height: `${displayHeight}px`,
            objectFit: "contain",
            borderRadius: "16px",
          }}
        />
        {/* 白枠タイトル */}
        <div
          style={{
            flex: 1,
            width: "100%",
            display: "flex",
            alignItems: "stretch",
            justifyContent: "center",
            padding: "16px 32px",
          }}
        >
          <div
            style={{
              width: "100%",
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px 40px",
            }}
          >
            <div
              style={{
                color: "#1a1a1a",
                fontSize,
                fontWeight: 700,
                textAlign: "center",
                lineHeight: 1.4,
                wordBreak: "break-word",
              }}
            >
              {title}
            </div>
          </div>
        </div>
        {/* マーク */}
        <img
          src={markDataUri}
          width={60}
          height={57}
          style={{ marginBottom: "20px" }}
        />
      </div>
    );
  }

  const svg = await satori(element, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: [
      {
        name: "Noto Sans JP",
        data: font,
        weight: 700,
        style: "normal",
      },
    ],
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: OG_WIDTH },
  });
  return resvg.render().asPng();
}

app.get("/default.png", async (c) => {
  const isDev = c.env.ENVIRONMENT === "development";

  if (!isDev) {
    const cached = await c.env.OG.get("default.png");
    if (cached) {
      return new Response(cached.body, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
  }

  const png = await generateDefaultOgImage();

  if (!isDev) {
    await c.env.OG.put("default.png", png, {
      httpMetadata: { contentType: "image/png" },
    });
  }

  return new Response(png.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": isDev ? "no-cache" : "public, max-age=31536000, immutable",
    },
  });
});

app.get("/p/:filename", async (c) => {
  const isDev = c.env.ENVIRONMENT === "development";
  const filename = c.req.param("filename");
  if (!filename || !filename.endsWith(".png")) {
    return c.notFound();
  }
  const idStr = filename.replace(".png", "");
  const pageId = parseInt(idStr, 10);
  if (isNaN(pageId)) {
    return c.notFound();
  }

  const cacheKey = `p/${pageId}.png`;

  if (!isDev) {
    const cached = await c.env.OG.get(cacheKey);
    if (cached) {
      return new Response(cached.body, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }
  }

  const db = getDB(c.env.DB);
  const page = await db
    .select({ title: pages.title, image: pages.image })
    .from(pages)
    .where(eq(pages.id, pageId))
    .limit(1);

  if (page.length === 0) {
    return c.notFound();
  }

  const { title, image } = page[0];

  let png: Uint8Array;

  if (image) {
    png = await generateImageWithTitleOgImage(title, image);
  } else {
    png = await generateTitleOgImage(title);
  }

  if (!isDev) {
    await c.env.OG.put(cacheKey, png, {
      httpMetadata: { contentType: "image/png" },
    });
  }

  return new Response(png.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": isDev ? "no-cache" : "public, max-age=86400",
    },
  });
});

export class RegenerateWorkflow extends WorkflowEntrypoint<
  Bindings,
  RegenerateParams
> {
  async run(event: WorkflowEvent<RegenerateParams>, step: WorkflowStep) {
    const { pageId } = event.payload;

    const cacheKey = `p/${pageId}.png`;
    await step.do("delete-cache", async () => {
      await this.env.OG.delete(cacheKey);
    });

    const pageInfo = await step.do("fetch-page-info", async () => {
      const db = getDB(this.env.DB);
      const page = await db
        .select({ title: pages.title, image: pages.image })
        .from(pages)
        .where(eq(pages.id, pageId))
        .limit(1);

      if (page.length === 0) {
        throw new Error(`Page not found: ${pageId}`);
      }
      return page[0];
    });

    await step.do("regenerate-og", async () => {
      const { title, image } = pageInfo;

      let png: Uint8Array;
      if (image) {
        png = await generateImageWithTitleOgImage(title, image);
      } else {
        png = await generateTitleOgImage(title);
      }

      await this.env.OG.put(cacheKey, png, {
        httpMetadata: { contentType: "image/png" },
      });
    });

    return { pageId, cacheKey, regenerated: true };
  }
}

export default app;
