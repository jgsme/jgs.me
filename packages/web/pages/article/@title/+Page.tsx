import React from "react";
import { useData } from "vike-react/useData";
import type data from "./+data";
import { ScrapboxBlock } from "./components/ScrapboxBlock";
import { CopyButton } from "./components/CopyButton";
import { RelatedPages } from "./components/RelatedPages";
import { clientOnly } from "vike-react/clientOnly";

// 反応は SSR に載せない。記事ページは s-maxage=86400 でエッジに載るため、
// 含めるとキャッシュが切れるまで反応が増えない。島として切り出してクライアントで
// /api/reactions/:pageID を引く。モジュールスコープで一度だけ呼ぶ (レンダーごとに
// 呼ぶと import が繰り返される)。
const ReactionsIsland = clientOnly(() => import("./components/Reactions"));

type Data = Awaited<ReturnType<typeof data>>;

const Page = () => {
  const d = useData<Data>();

  if (!d.ok) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">{d.title}</h1>
        <p className="text-neutral-500">Page not found</p>
      </main>
    );
  }

  // fromDate は "YYYY-MM-DD" か null (+data.ts)。dt-published にはそのまま入れ、
  // 表示は従来どおり "/" 区切りにする。日付が取れない記事もあるため、null なら
  // dt-published ごと出さない。
  const publishedDisplay = d.fromDate ? d.fromDate.replaceAll("-", "/") : null;
  const canonical = `https://w.jgs.me/pages/${encodeURIComponent(d.title)}`;

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      {/* h-entry はタイトル・日付・本文を全部含む。反応と関連記事はこの外。
          中に入れると mf2 パーサが反応側の要素を記事のプロパティとして読む。 */}
      <article className="h-entry">
        <div className="mb-8">
          <h1 className="p-name text-2xl font-bold">{d.title}</h1>
          <div className="flex gap-2">
            {d.fromDate && (
              <p className="text-neutral-500 text-sm mt-1">
                <time className="dt-published" dateTime={d.fromDate!}>
                  {publishedDisplay}
                </time>
              </p>
            )}
            <CopyButton articleId={d.articleId} />
          </div>
        </div>

        {/* hidden な要素も mf2 パーサは読む。表示を変えずに機械可読性だけ足せる。 */}
        <a className="u-url" href={canonical} hidden>
          {d.title}
        </a>
        <span className="p-author h-card" hidden>
          <a className="u-url" href="https://w.jgs.me/">
            <span className="p-name">jigsaw</span>
          </a>
        </span>

        {/* 本文全体を e-content で包む。 */}
        <div className="e-content space-y-1">
          {d.blocks.map((block, i) => (
            <ScrapboxBlock key={i} block={block} />
          ))}
        </div>
      </article>

      <ReactionsIsland pageId={d.pageId} />
      <RelatedPages related={d.related} />
      {/^\d{4}$/.test(d.title) && (
        <div className="mt-12 flex justify-center">
          <a
            href="/on-this-day"
            className="group relative inline-flex items-center justify-center px-16 py-8 font-bold text-white transition-all duration-300 bg-neutral-900 rounded-full overflow-hidden hover:scale-105 active:scale-95"
          >
            <div className="absolute inset-0 w-full h-full bg-[url('/warp.gif')] bg-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span className="relative z-10 text-5xl">WARP</span>
          </a>
        </div>
      )}
    </main>
  );
};

export default Page;
