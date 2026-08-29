import React from "react";
const GA_ID = "G-SJB62M7N1F";

export function Head() {
  return (
    <>
      {/* 全ページで宣言する。記事以外の URL に送られた Webmention も、
          target が公開記事でなければ Queue 側で落ちるだけで害はない。 */}
      <link rel="webmention" href="https://w.jgs.me/webmention" />

      {/* IndieAuth の所有証明の土台。actor 側から指し返すのは別途。 */}
      <link rel="me" href="https://w.jgs.me/ap/actor" />

      {/* feed autodiscovery。reader はトップを見に来るので全ページで出す。
          2 本あるので title で見分けられるようにする (同じ題だと reader 側で
          どちらか分からない)。 */}
      <link
        rel="alternate"
        type="application/rss+xml"
        title="Articles"
        href="/rss.xml"
      />
      <link
        rel="alternate"
        type="application/rss+xml"
        title="Clips"
        href="/clips.xml"
      />

      <script
        async
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}');
          `,
        }}
      />
    </>
  );
}
