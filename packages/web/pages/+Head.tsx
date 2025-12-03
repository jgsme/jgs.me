const OG_BASE_URL = "https://og.w.jgs.me";

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
