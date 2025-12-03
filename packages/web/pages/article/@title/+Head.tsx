import React from "react";
import { useData } from "vike-react/useData";
import type data from "./+data";
import { OG_BASE_URL } from "@/constants/og";

type Data = Awaited<ReturnType<typeof data>>;

export function Head() {
  const d = useData<Data>();

  const ogUrl = `https://w.jgs.me/pages/${encodeURIComponent(d.title)}`;
  const ogImage = d.pageId
    ? `${OG_BASE_URL}/p/${d.pageId}.png`
    : `${OG_BASE_URL}/default.png`;

  return (
    <>
      <link
        rel="alternate"
        type="application/rss+xml"
        title="RSS Feed"
        href="/rss.xml"
      />
      <meta property="og:type" content="article" />
      <meta property="og:site_name" content="I am Electrical machine" />
      <meta property="og:url" content={ogUrl} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta name="twitter:card" content="summary_large_image" />
      {d.description && (
        <meta property="og:description" content={d.description} />
      )}
    </>
  );
}
