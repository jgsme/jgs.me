import React from "react";
import { useData } from "vike-react/useData";
import type data from "./+data";
import { OG_BASE_URL } from "@/constants/og";
import { zetCanonical } from "../zetView";

type Data = Awaited<ReturnType<typeof data>>;

export function Head() {
  const d = useData<Data>();

  return (
    <>
      <meta property="og:type" content="article" />
      <meta property="og:site_name" content="I am Electrical machine" />
      <meta property="og:url" content={zetCanonical(d.rkey)} />
      <meta property="og:image" content={`${OG_BASE_URL}/p/${d.pageId}.png`} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta name="twitter:card" content="summary_large_image" />
      {d.description && (
        <meta property="og:description" content={d.description} />
      )}
    </>
  );
}
