import React from "react";
import { useData } from "vike-react/useData";
import type data from "./+data";
import { ScrapboxBlock } from "../../article/@title/components/ScrapboxBlock";
import {
  SpoilerGate,
  remeasure,
} from "../../article/@title/components/SpoilerGate";
import { OEmbedsContext } from "../../article/@title/components/OEmbed";
import { XhtmPartsContext } from "../../article/@title/components/XhtmHost";

export const DRAFT_NOTICE = "下書き。公開前の確認用";

type Data = Awaited<ReturnType<typeof data>>;

const Page = () => {
  const d = useData<Data>();

  // 公開記事の mf2 (h-entry など) は出さない。下書きを parser や
  // Webmention の対象にしないため。共有・反応・関連・日付も持たない。
  return (
    <main className="max-w-content mx-auto px-4 py-8">
      <p className="mb-6 border border-solid border-border bg-bg px-3 py-2 text-sm text-fg-muted">
        {DRAFT_NOTICE}
      </p>
      <h1 className="text-2xl font-bold mb-8">{d.title}</h1>
      <div className="e-content space-y-1">
        <OEmbedsContext value={d.embeds}>
          <XhtmPartsContext value={d.xhtm}>
            <SpoilerGate spoiler={d.spoiler} onReveal={remeasure}>
              {d.blocks.map((block, i) => (
                <ScrapboxBlock key={i} block={block} />
              ))}
            </SpoilerGate>
          </XhtmPartsContext>
        </OEmbedsContext>
      </div>
    </main>
  );
};

export default Page;
