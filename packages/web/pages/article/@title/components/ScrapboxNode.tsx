import React from "react";
import type { Node as NodeType } from "@progfay/scrapbox-parser";
import { bodyImageSources } from "@/utils/bodyImage";

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

export const ScrapboxNode: React.FC<{ node: NodeType }> = ({ node }) => {
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
            <ScrapboxNode key={i} node={n} />
          ))}
        </span>
      );
    }

    case "code":
      return (
        <code className="bg-surface-strong px-1 py-0.5 rounded text-sm font-mono">
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
        <blockquote className="bg-black/1 border-l-4 border-border pl-1 py-0.5">
          {node.nodes.map((n, i) => (
            <ScrapboxNode key={i} node={n} />
          ))}
        </blockquote>
      );

    case "strong":
      return (
        <strong>
          {node.nodes.map((n, i) => (
            <ScrapboxNode key={i} node={n} />
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
            <ScrapboxNode key={i} node={n} />
          ))}
        </>
      );

    default:
      // helpfeel / formula / strongImage / strongIcon / googleMap / commandLine / blank など
      // 未対応のノード。本文が黙って消えないよう、必ず raw をテキストとして残す
      return <>{node.raw}</>;
  }
};
