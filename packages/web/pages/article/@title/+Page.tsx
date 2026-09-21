import React from "react";
import { useData } from "vike-react/useData";
import type data from "./+data";
import { ScrapboxBlock } from "./components/ScrapboxBlock";
import { QuoteRun } from "./components/QuoteRun";
import { groupQuoteRuns } from "./components/quote";
import { CopyButton } from "./components/CopyButton";
import { shareUrlPath } from "./components/shareUrl";
import { RelatedPages } from "./components/RelatedPages";
import { Backlinks } from "./components/Backlinks";
import { clientOnly } from "vike-react/clientOnly";
import { WarpButton } from "../../components/WarpButton";

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
      <main className="max-w-content mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">{d.title}</h1>
        {/* 被リンクがあれば題と関連ページだけのページとして見せる。
            「Page not found」を出すのは本当に何も無いときだけ。 */}
        {d.backlinks.length === 0 && (
          <p className="text-fg-muted">Page not found</p>
        )}
        <Backlinks
          title={d.title}
          initial={d.backlinks}
          initialHasMore={d.hasMore}
        />
      </main>
    );
  }

  // fromDate は "YYYY-MM-DD" か null (+data.ts)。dt-published にはそのまま入れ、
  // 表示は従来どおり "/" 区切りにする。日付が取れない記事もあるため、null なら
  // dt-published ごと出さない。
  const publishedDisplay = d.fromDate ? d.fromDate.replaceAll("-", "/") : null;
  const canonical = `https://w.jgs.me/pages/${encodeURIComponent(d.title)}`;

  // 引用が本体の clip か。diary で人が選んだ kind をそのまま見る。
  //
  // 以前は本文をパースして「引用が 1 つだけある」「引用が題で始まる」で判定して
  // いたが、画像と引用の両方があるページ 183 件を目で見たところ 141 件 (77%) が
  // 機械判定と食い違った。引用元のスクショを貼っただけの link が軒並み引用扱いに
  // なる。判定をやめ、diary 側で選ばれた値に従う。
  //
  // 引用を大きく出すのと、題を本文の下に回すのは同じ条件。題を下げるのは、題が
  // 引用そのままのとき同じ文が h1 と引用で二度大きく出るため。kind が quote の
  // 151 件のうち題が引用と重なるのは 83 件だが、重ならない 68 件でも「引用が
  // 主役で題は添え物」という並びは変わらない。
  const quoteClip = d.clipKind === "quote";
  // 写真が本体の clip も、写真を本文幅の外まで広げて主役にし、題は下に回す。
  const photoClip = d.clipKind === "photo";
  const titleBelow = quoteClip || photoClip;

  // 動画が本体の clip では、本文の最初のブロックにある動画を大きく出す
  // (clip-video-body の CSS)。どれを大きくするかを JS で探さないのは、出典の行が
  // 本文の先頭に来る前提が既に成り立っているため。本番の video clip 168 件のうち
  // 最初のブロックが動画なのは 157 件で、外れていた 7 件は本文を直した。残り 4 件は
  // diary 由来で、出典行を先頭に置く変更のあと publish し直すと揃う。
  const videoClip = d.clipKind === "video";
  const header = (
    <div className={titleBelow ? "mt-8" : "mb-8"}>
      <h1
        className={`p-name font-bold ${titleBelow ? "text-base" : "text-2xl"}`}
      >
        {d.title}
      </h1>
      <div className="flex gap-2">
        {d.fromDate && (
          <p className="text-fg-subtle text-sm mt-1">
            <time className="dt-published" dateTime={d.fromDate!}>
              {publishedDisplay}
            </time>
          </p>
        )}
        <CopyButton
          path={shareUrlPath({ articleId: d.articleId, clipId: d.clipId })}
        />
      </div>
    </div>
  );

  return (
    <main className="max-w-content mx-auto px-4 py-8">
      {/* h-entry はタイトル・日付・本文を全部含む。反応と関連記事はこの外。
          中に入れると mf2 パーサが反応側の要素を記事のプロパティとして読む。
          header の位置は変わるが、h-entry の中に居れば mf2 の読み取りは変わらない。 */}
      <article className="h-entry">
        {!titleBelow && header}

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
        <div
          className={`e-content space-y-1 ${videoClip ? "clip-video-body" : ""}`}
        >
          {quoteClip
            ? // 引用が主役のページでは、連続する引用行を 1 つの引用として出す。
              groupQuoteRuns(d.blocks).map((item, i) =>
                item.type === "quoteRun" ? (
                  <QuoteRun key={i} lines={item.lines} indent={item.indent} />
                ) : (
                  <ScrapboxBlock key={i} block={item.block} emphasizeQuote />
                ),
              )
            : d.blocks.map((block, i) => (
                <ScrapboxBlock key={i} block={block} photo={photoClip} />
              ))}
        </div>

        {titleBelow && header}
      </article>

      <ReactionsIsland pageId={d.pageId} />
      {/* 被リンクは clip のページだけ (+data.ts)。h-entry の外に置く。中に
          入れると mf2 パーサが記事のプロパティとして読む。 */}
      <Backlinks
        title={d.title}
        initial={d.backlinks}
        initialHasMore={d.hasMore}
      />
      <RelatedPages related={d.related} />
      {/^\d{4}$/.test(d.title) && <WarpButton />}
    </main>
  );
};

export default Page;
