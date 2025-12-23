import {
  generateDefaultOgImage,
  generateImageWithTitleOgImage,
  generateTitleOgImage,
} from "../src/image";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { initWasm } from "@resvg/resvg-wasm";

const outputDir = path.resolve(import.meta.dir, "../dist");

async function initializeWasm() {
  // @ts-expect-error require.resolve is not in standard TS typings
  const wasmPath = require.resolve("@resvg/resvg-wasm/index_bg.wasm");
  const wasmBuffer = await readFile(wasmPath);
  await initWasm(wasmBuffer);
}

async function main() {
  await initializeWasm();
  await mkdir(outputDir, { recursive: true });

  const [command, ...args] = Bun.argv.slice(2);

  switch (command) {
    case "default": {
      console.log("Generating default OG image...");
      const png = await generateDefaultOgImage();
      const outputPath = path.join(outputDir, "default.png");
      await writeFile(outputPath, png);
      console.log(`✅ Saved to ${outputPath}`);
      break;
    }
    case "title": {
      const title = args[0];
      if (!title) {
        console.error("Error: Title argument is missing.");
        console.error("Usage: bun run scripts/generate-image.ts title <title>");
        process.exit(1);
      }
      console.log(`Generating OG image with title: "${title}"...`);
      const png = await generateTitleOgImage(title);
      const outputPath = path.join(outputDir, "title.png");
      await writeFile(outputPath, png);
      console.log(`✅ Saved to ${outputPath}`);
      break;
    }
    case "image": {
      const title = args[0];
      const imageUrl = args[1];
      if (!title || !imageUrl) {
        console.error("Error: Title or imageUrl argument is missing.");
        console.error(
          "Usage: bun run scripts/generate-image.ts image <title> <imageUrl>"
        );
        process.exit(1);
      }
      console.log(
        `Generating OG image with title: "${title}" and image: ${imageUrl}...`
      );
      const png = await generateImageWithTitleOgImage(title, imageUrl);
      const outputPath = path.join(outputDir, "image.png");
      await writeFile(outputPath, png);
      console.log(`✅ Saved to ${outputPath}`);
      break;
    }
    default: {
      console.log("Unknown command. Available commands: default, title, image");
    }
  }
}

main().catch((err) => {
  console.error("Error generating image:", err);
  process.exit(1);
});
