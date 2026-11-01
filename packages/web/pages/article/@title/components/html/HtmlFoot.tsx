import React from "react";
import { clientOnly } from "vike-react/clientOnly";
import { pagePath } from "@jigsaw/db/page-path";
import type { HtmlArticleData } from "../../htmlArticleData";
import { SearchForm } from "../../../../components/SearchForm";
import { CopyButton } from "../CopyButton";
import { RelatedPages } from "../RelatedPages";
import { shareUrlPath } from "../shareUrl";

// 反応は SSR に載せない (+Page.tsx と同じ理由)。
const ReactionsIsland = clientOnly(() => import("../Reactions"));

// HTML article の下の帯。上から 検索とランダム → 題・日付・共有 URL → 反応 → 関連。
// sb の記事ページと違って検索窓は上に置かない (Layout が出さない)。
export const HtmlFoot: React.FC<{ d: HtmlArticleData }> = ({ d }) => {
  const canonical = `https://w.jgs.me${pagePath(d.title)}`;
  const publishedDisplay = d.fromDate ? d.fromDate.replaceAll("-", "/") : null;

  return (
    <div className="jgs-e4-foot bg-brand text-paper px-4">
      <div className="max-w-content mx-auto pt-6 pb-16">
        <SearchForm tone="onBrand" />

        {/* h-entry は題・日付・本文だけ。反応と関連はこの外 (+Page.tsx と同じ)。 */}
        <article className="h-entry pt-4">
          <h1 className="p-name text-2xl font-bold leading-snug text-balance">
            {d.heading}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-1 text-sm text-on-brand-muted">
            {d.fromDate && (
              <time className="dt-published" dateTime={d.fromDate}>
                {publishedDisplay}
              </time>
            )}
            <span className="text-[11px] tracking-[0.08em] leading-relaxed border border-solid border-white/40 text-paper rounded px-1">
              HTML
            </span>
            <CopyButton
              tone="onBrand"
              path={shareUrlPath({
                articleId: d.articleId,
                clipId: null,
                zetId: null,
              })}
            />
          </div>

          <a className="u-url" href={canonical} hidden>
            {d.heading}
          </a>
          <span className="p-author h-card" hidden>
            <a className="u-url" href="https://w.jgs.me/">
              <span className="p-name">jigsaw</span>
            </a>
          </span>

          {/* e-content は描いた HTML ではなく派生テキストにする。描いた入れ物は
              h-entry の外 (ヘッダと帯の間) にあり、包もうとすると題・日付と同じ
              article の中に AI の script や style が入る。mf2 の html 値に script と
              style が混ざり、受け手 (webmention.io / Bridgy) の抜粋が汚れる。
              派生テキストなら RSS や配信の抜粋と同じ文になる。hidden でも mf2
              パーサは読む。 */}
          <div className="e-content" hidden>
            {d.text.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </article>

        <ReactionsIsland pageId={d.pageId} tone="onBrand" />
        <RelatedPages related={d.related} tone="onBrand" />
      </div>
    </div>
  );
};
