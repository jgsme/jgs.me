import { useData } from "vike-react/useData";
import { isVideoExt } from "@jigsaw/media";
import { SITE_URL } from "../../src/config";
import { ogImageURL, ogVideoFrameURL } from "../../src/page";
import type { ImageData } from "./+data";

export function Head() {
  const d = useData<ImageData>();

  if (isVideoExt(d.ext)) {
    return (
      <>
        <meta property="og:type" content="video.other" />
        <meta property="og:url" content={`${SITE_URL}/${d.id}`} />
        <meta property="og:video" content={d.direct} />
        <meta property="og:video:secure_url" content={d.direct} />
        <meta property="og:video:type" content="video/mp4" />
        {d.width !== null && (
          <meta property="og:video:width" content={String(d.width)} />
        )}
        {d.height !== null && (
          <meta property="og:video:height" content={String(d.height)} />
        )}
        {/* 寸法はフレームのものと一致する保証がないので og:image:width は出さない */}
        <meta property="og:image" content={ogVideoFrameURL(d.id, d.ext)} />
        <meta name="twitter:card" content="summary_large_image" />
      </>
    );
  }

  return (
    <>
      <meta property="og:type" content="website" />
      <meta property="og:url" content={`${SITE_URL}/${d.id}`} />
      <meta property="og:image" content={ogImageURL(d.id, d.ext)} />
      {d.width !== null && (
        <meta property="og:image:width" content={String(d.width)} />
      )}
      {d.height !== null && (
        <meta property="og:image:height" content={String(d.height)} />
      )}
      <meta name="twitter:card" content="summary_large_image" />
    </>
  );
}
