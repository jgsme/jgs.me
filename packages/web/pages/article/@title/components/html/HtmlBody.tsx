import React, { useMemo } from "react";

// HTML article の本文。body は入れ物 (.jgs-html-article) の要素ごとの文字列で、
// そのまま innerHTML として描く。
//
// hydration では React は dangerouslySetInnerHTML の中身を DOM と比べ直さず、
// 書き換えもしない。SSR の HTML を parser が読んだ時点で中の script が動き、
// script が組み替えた DOM がそのまま残る。
//
// 再描画で innerHTML を入れ直されると script が組んだ DOM が消えるので、
// __html を渡す object は useMemo で固定する。React は __html の文字列が
// 変わった時だけ innerHTML を入れ直すが、object ごと固定しておけば body が
// 同じである限り触られないことがこの component だけで読める。呼ぶ側も
// この要素を key の変更や条件分岐で作り直さないこと。
export const HtmlBody: React.FC<{ body: string }> = ({ body }) => {
  const html = useMemo(() => ({ __html: body }), [body]);
  return <div className="html-article-host" dangerouslySetInnerHTML={html} />;
};
