import React from "react";
import { OG_BASE_URL } from "@/constants/og";

export function Head() {
  return (
    <>
      <meta property="og:image" content={`${OG_BASE_URL}/default.png`} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta name="twitter:card" content="summary_large_image" />
    </>
  );
}
