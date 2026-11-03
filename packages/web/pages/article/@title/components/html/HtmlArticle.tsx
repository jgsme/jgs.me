import React, { useEffect } from "react";
import { usePageContext } from "vike-react/usePageContext";
import type { HtmlArticleData } from "../../htmlArticleData";
import { shouldReloadOnArrival } from "@/utils/htmlNavigation";
import { SpoilerGate, remeasure } from "../SpoilerGate";
import { HtmlBody } from "./HtmlBody";
import { HtmlFoot } from "./HtmlFoot";
import { OverwriteHeader } from "./OverwriteHeader";
import "./overwrite.css";

// HTML article のページ。上の E4 ヘッダ → 画面幅いっぱいの本文 → 下の帯。
export const HtmlArticle: React.FC<{ d: HtmlArticleData }> = ({ d }) => {
  const reload = shouldReloadOnArrival(usePageContext());

  // クライアント遷移で来ると、innerHTML で入れた本文の script が動かない。
  // 何も描かずにページを丸ごと読み込み直す (htmlNavigation.ts)。
  useEffect(() => {
    if (reload) window.location.reload();
  }, [reload]);

  if (reload) return null;

  return (
    <>
      <OverwriteHeader title={d.heading} date={d.fromDate} />
      {/* 本文は本文幅 (max-w-content) に入れない */}
      <SpoilerGate spoiler={d.spoiler} onReveal={remeasure}>
        <HtmlBody body={d.render.body} />
      </SpoilerGate>
      <HtmlFoot d={d} />
    </>
  );
};
