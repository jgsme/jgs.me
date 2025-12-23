import satori from "satori";
import { Resvg } from "@resvg/resvg-wasm";

const truncateString = (str: string, maxLength: number) => {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength) + "...";
};

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const BG_COLOR = "#82221c";

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
        width = (bytes[26] | (bytes[27] << 8)) & 0x3fff;
        height = (bytes[28] | (bytes[29] << 8)) & 0x3fff;
      }
      // VP8L
      else if (bytes[15] === 0x4c) {
        const bits =
          bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
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

export async function generateDefaultOgImage(): Promise<Uint8Array> {
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

export async function generateTitleOgImage(title: string): Promise<Uint8Array> {
  const font = await loadFont();

  let fontSize = 72;
  let maxLength = 50;
  if (title.length > 40) {
    fontSize = 48;
    maxLength = 80;
  } else if (title.length > 30) {
    fontSize = 56;
  }

  const truncatedTitle = truncateString(title, maxLength);
  const cardWidth = OG_WIDTH - 32 * 2;
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
          {truncatedTitle}
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

export async function generateImageWithTitleOgImage(
  title: string,
  imageUrl: string
): Promise<Uint8Array> {
  const font = await loadFont();

  const imageInfo = await fetchImageAsDataUri(imageUrl);
  const isLandscape = imageInfo.width > imageInfo.height;

  let element: React.ReactNode;

  if (!isLandscape) {
    let fontSize = 52;
    let maxLength = 35;
    if (title.length > 30) {
      fontSize = 36;
      maxLength = 55;
    } else if (title.length > 20) {
      fontSize = 44;
    }
    const truncatedTitle = truncateString(title, maxLength);

    let displayWidth = imageInfo.width;
    let displayHeight = imageInfo.height;

    if (displayHeight > OG_HEIGHT) {
      const scale = OG_HEIGHT / displayHeight;
      displayHeight = OG_HEIGHT;
      displayWidth = Math.round(imageInfo.width * scale);
    }
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
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "32px",
          }}
        >
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
              {truncatedTitle}
            </div>
          </div>
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
    let fontSize = 44;
    let maxLength = 45;
    if (title.length > 60) {
      fontSize = 28;
      maxLength = 90;
    } else if (title.length > 30) {
      fontSize = 36;
    }
    const truncatedTitle = truncateString(title, maxLength);

    const maxImageWidth = OG_WIDTH - 64;
    let displayWidth = imageInfo.width;
    let displayHeight = imageInfo.height;

    if (displayWidth > maxImageWidth) {
      const scale = maxImageWidth / displayWidth;
      displayWidth = maxImageWidth;
      displayHeight = Math.round(imageInfo.height * scale);
    }
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
        <img
          src={imageInfo.dataUri}
          style={{
            width: `${displayWidth}px`,
            height: `${displayHeight}px`,
            objectFit: "contain",
            borderRadius: "16px",
          }}
        />
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
              {truncatedTitle}
            </div>
          </div>
        </div>
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
