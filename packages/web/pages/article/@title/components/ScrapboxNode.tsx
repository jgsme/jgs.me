import React from "react";
import type { Node as NodeType } from "@progfay/scrapbox-parser";
import {
  bodyImageSources,
  photoImageSources,
  QUOTE_CLIP_IMAGE_WIDTH,
} from "@/utils/bodyImage";
import { quoteClassName } from "./quote";

function getYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (
      (parsed.hostname === "www.youtube.com" ||
        parsed.hostname === "youtube.com") &&
      parsed.pathname === "/watch"
    ) {
      return parsed.searchParams.get("v");
    }
    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.slice(1);
    }
    if (
      (parsed.hostname === "www.youtube.com" ||
        parsed.hostname === "youtube.com") &&
      parsed.pathname.startsWith("/embed/")
    ) {
      return parsed.pathname.slice(7);
    }
  } catch {
    return null;
  }
  return null;
}

export const ScrapboxNode: React.FC<{
  node: NodeType;
  /* 行のインデント段数。引用のはみ出しを止めるためだけに使う。ScrapboxBlock が
     行から渡し、子の node へはそのまま伝える。 */
  indent?: number;
  /* 引用が主役のページ (kind が quote の clip) か。引用を大きく出し、本文画像を
     小さく出す。indent と同じく子の node へそのまま伝える。 */
  emphasizeQuote?: boolean;
  /* 写真が主役のページ (kind が photo の clip) か。本文画像を本文幅の外まで広げる。 */
  photo?: boolean;
}> = ({ node, indent = 0, emphasizeQuote = false, photo = false }) => {
  switch (node.type) {
    case "plain":
      return <>{node.text}</>;

    case "link": {
      if (node.pathType === "relative") {
        return (
          <a
            href={`/pages/${encodeURIComponent(node.href)}`}
            className="text-link hover:underline"
          >
            {node.href}
          </a>
        );
      }

      const youtubeId = getYouTubeVideoId(node.href);
      if (youtubeId) {
        return (
          <div className="my-4">
            <iframe
              className="w-full aspect-video rounded"
              src={`https://www.youtube.com/embed/${youtubeId}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        );
      }

      return (
        <a
          href={node.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-link hover:underline"
        >
          {node.content || node.href}
        </a>
      );
    }

    case "hashTag":
      return (
        <a
          href={`/pages/${encodeURIComponent(node.href)}`}
          className="text-link hover:underline"
        >
          #{node.href}
        </a>
      );

    case "image": {
      // scrapbox-parser は Gyazo の URL を /thumb/1000 に正規化するので、
      // 移行前の本文は Gyazo 側で縮小された版を受け取っていた。R2 に移すと
      // その縮小が外れて原寸が飛ぶため、こちらで幅を与え直す。
      //
      // 写真の clip では画像を画面中央基準で広げる。インデントされた行では
      // 広げない (中央に寄せるとインデントぶんの位置を失う。引用と同じ理由)。
      if (photo && indent === 0) {
        const image = photoImageSources(node.src);
        return (
          <span className="block photo-bleed my-2">
            <img
              src={image.src}
              srcSet={image.srcSet}
              sizes={image.sizes}
              alt=""
              className="block max-w-full h-auto rounded mx-auto"
              loading="lazy"
              decoding="async"
            />
          </span>
        );
      }
      if (!emphasizeQuote) {
        const image = bodyImageSources(node.src);
        return (
          <img
            src={image.src}
            srcSet={image.srcSet}
            sizes={image.sizes}
            alt=""
            className="max-w-full h-auto rounded my-2"
            loading="lazy"
            decoding="async"
          />
        );
      }
      // 引用の clip では引用が主役なので、画像は 24rem に絞って中央に置く。
      // 幅の上限は img ではなく包む span に持たせる。img に max-w-96 を直に付けると、
      // 本文幅が 24rem を切るスマホで max-w-full との両立ができずはみ出す。
      // block の span は親の幅に収まったうえで 24rem で止まるので、中の img は
      // max-w-full のままでよい。
      const image = bodyImageSources(node.src, {
        width: QUOTE_CLIP_IMAGE_WIDTH,
      });
      return (
        <span className="block max-w-96 mx-auto my-2">
          <img
            src={image.src}
            srcSet={image.srcSet}
            sizes={image.sizes}
            alt=""
            className="max-w-full h-auto rounded mx-auto"
            loading="lazy"
            decoding="async"
          />
        </span>
      );
    }

    case "decoration": {
      const classes: string[] = [];
      if (node.decos.includes("*-1")) classes.push("text-xl font-bold");
      if (node.decos.includes("*-2")) classes.push("text-2xl font-bold");
      if (node.decos.includes("*-3")) classes.push("text-3xl font-bold");
      if (node.decos.some((d) => d === "/")) classes.push("italic");
      if (node.decos.some((d) => d === "-")) classes.push("line-through");

      return (
        <span className={classes.join(" ")}>
          {node.nodes.map((n, i) => (
            <ScrapboxNode
              key={i}
              node={n}
              indent={indent}
              emphasizeQuote={emphasizeQuote}
            />
          ))}
        </span>
      );
    }

    case "code":
      return (
        <code className="bg-surface-strong px-1 py-1 rounded text-sm font-mono">
          {node.text}
        </code>
      );

    case "icon": {
      if (node.pathType === "relative") {
        return (
          <a
            href={`/pages/${encodeURIComponent(node.path)}`}
            className="text-link hover:underline"
          >
            {node.path}
          </a>
        );
      }
      return <>{node.path}</>;
    }

    case "quote":
      return (
        <blockquote
          className={quoteClassName(node, {
            emphasize: emphasizeQuote,
            indent,
          })}
        >
          {node.nodes.map((n, i) => (
            <ScrapboxNode
              key={i}
              node={n}
              indent={indent}
              emphasizeQuote={emphasizeQuote}
            />
          ))}
        </blockquote>
      );

    case "strong":
      return (
        <strong>
          {node.nodes.map((n, i) => (
            <ScrapboxNode
              key={i}
              node={n}
              indent={indent}
              emphasizeQuote={emphasizeQuote}
            />
          ))}
        </strong>
      );

    case "numberList":
      // NumberListNode は行ブロックではなく inline node なので ol には畳めない。
      // packages/ap/src/scrapbox.ts の numberList の扱いと同じく "N. 中身" として inline で出す
      return (
        <>
          {node.number}.{" "}
          {node.nodes.map((n, i) => (
            <ScrapboxNode
              key={i}
              node={n}
              indent={indent}
              emphasizeQuote={emphasizeQuote}
            />
          ))}
        </>
      );

    default:
      // helpfeel / formula / strongImage / strongIcon / googleMap / commandLine / blank など
      // 未対応のノード。本文が黙って消えないよう、必ず raw をテキストとして残す
      return <>{node.raw}</>;
  }
};
