import React, { createContext, useContext, useEffect, useRef } from "react";
import type { OEmbed, OEmbeds } from "@/server/oembed";

export const OEmbedsContext = createContext<OEmbeds>({});

export function useOEmbed(url: string): OEmbed | null {
  return useContext(OEmbedsContext)[url] ?? null;
}

const BSKY_EMBED_JS = "https://embed.bsky.app/static/embed.js";

declare global {
  interface Window {
    bluesky?: { scan: (node?: Pick<Element, "querySelectorAll">) => void };
  }
}

let bskyScript: Promise<void> | null = null;

function loadBskyScript(): Promise<void> {
  if (window.bluesky) return Promise.resolve();
  bskyScript ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = BSKY_EMBED_JS;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      bskyScript = null;
      reject(new Error("embed.js load failed"));
    };
    document.head.appendChild(s);
  });
  return bskyScript;
}

// SSR では blockquote をそのまま出す (JS が無くても読める)。マウント後に
// embed.js を読み、この要素の中だけ scan させて iframe に差し替える。
// embed.js は blockquote を replaceWith で置き換えるので、React が中身を
// 管理しない dangerouslySetInnerHTML の内側に閉じ込める。幅の上限 600px は
// embed.js が差し替え後の要素に付ける。クライアント遷移で
// 来たときも useEffect が走るので再スキャンの口はこれで足りる。
const BlueskyEmbed: React.FC<{ html: string }> = ({ html }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    loadBskyScript()
      .then(() => {
        if (!cancelled && ref.current) window.bluesky?.scan(ref.current);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [html]);
  return (
    <div
      ref={ref}
      className="my-4"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export const OEmbedView: React.FC<{ embed: OEmbed }> = ({ embed }) => {
  if (embed.provider === "bluesky") return <BlueskyEmbed html={embed.html} />;
  return (
    <div className="my-4">
      <iframe
        className="w-full rounded-xl"
        src={embed.src}
        height={embed.height}
        title={embed.title}
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      />
    </div>
  );
};
