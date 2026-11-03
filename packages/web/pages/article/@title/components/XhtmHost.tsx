import React, { useMemo } from "react";
import { XHTM_HOST_CLASS } from "@/utils/htmlNavigation";

// code:xhtm の部品。html は diary が断片にした文字列で、そのまま innerHTML として描く。
// __html を渡す object を useMemo で固定する理由は HtmlBody.tsx と同じ
// (再描画で入れ直すと script が組んだ DOM が消える)。呼ぶ側も key の変更や
// 条件分岐でこの要素を作り直さないこと。
export const XhtmHost: React.FC<{ html: string }> = ({ html }) => {
  const inner = useMemo(() => ({ __html: html }), [html]);
  return <div className={XHTM_HOST_CLASS} dangerouslySetInnerHTML={inner} />;
};
