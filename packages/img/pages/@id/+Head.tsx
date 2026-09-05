import { useData } from "vike-react/useData";
import { SITE_URL } from "../../src/config";
import { ogImageURL } from "../../src/page";
import type { ImageData } from "./+data";

export function Head() {
  const d = useData<ImageData>();

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
