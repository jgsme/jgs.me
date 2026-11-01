import React from "react";
import { useData } from "vike-react/useData";
import type data from "./+data";
import { OG_BASE_URL } from "@/constants/og";
import { pagePath } from "@jigsaw/db/page-path";
import { isHtmlArticleData } from "@/utils/htmlArticle";
import type { HtmlArticleData } from "./htmlArticleData";

type Data = Awaited<ReturnType<typeof data>>;

export function Head() {
  const d = useData<Data>();

  const ogUrl = `https://w.jgs.me${pagePath(d.title)}`;
  const ogImage = d.pageId
    ? `${OG_BASE_URL}/p/${d.pageId}.png`
    : `${OG_BASE_URL}/default.png`;

  return (
    <>
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
      {isHtmlArticleData(d) && <HtmlArticleHead d={d as HtmlArticleData} />}
    </>
  );
}

// html 記事は組み直した <link> / <style> を文書順に head へ出す。
function HtmlArticleHead({ d }: { d: HtmlArticleData }) {
  return (
    <>
      {d.atUri && <link rel="site.standard.document" href={d.atUri} />}
      {d.render.head.links.map((link) => (
        // 値は組み直しの時点で検証済みの文字列。属性の列挙型には合わせない
        <link
          key={`l:${link.href}`}
          {...(link as React.LinkHTMLAttributes<HTMLLinkElement>)}
        />
      ))}
      {d.render.head.styles.map(({ css, media }, i) => (
        <style
          key={`s:${i}`}
          media={media ?? undefined}
          dangerouslySetInnerHTML={{ __html: css }}
        />
      ))}
    </>
  );
}
