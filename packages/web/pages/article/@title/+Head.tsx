import { useData } from "vike-react/useData";
import type data from "./+data";

type Data = Awaited<ReturnType<typeof data>>;

export function Head() {
  const d = useData<Data>();

  const ogUrl = `https://w.jgs.me/pages/${encodeURIComponent(d.title)}`;

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
      {d.description && (
        <meta property="og:description" content={d.description} />
      )}
    </>
  );
}
