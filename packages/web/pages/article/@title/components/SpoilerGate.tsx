import React, { useEffect, useRef, useState } from "react";

// ネタバレの page は押すまで本文を見せない。本文は HTML に描いたまま
// hidden で隠すだけなので、bot や mf2 を読む側には本文が渡る。
//
// onReveal は本文を見せた後に呼ぶ。HTML article の script は隠れた入れ物の
// 中でも動き、その間に測った幅や高さは 0 になる。見せた後に resize を投げて
// 測り直させるのに使う。click handler ではなく revealed が true になった後の
// effect で呼ぶのは、hidden が外れた DOM が commit されてからでないと測り直しても
// 0 のままのため。
// 本文を見せた後に resize を投げ、隠れている間に幅や高さを 0 と測った
// script (HTML article、xhtm の部品) に測り直させる。
export const remeasure = () => window.dispatchEvent(new Event("resize"));

export const SpoilerGate: React.FC<{
  spoiler: boolean;
  children: React.ReactNode;
  onReveal?: () => void;
}> = ({ spoiler, children, onReveal }) => {
  const [revealed, setRevealed] = useState(false);
  // onReveal を effect の依存に入れると、親の再描画で関数が変わるたびに
  // 呼び直してしまう。見せた 1 回だけ呼べばよいので ref で最新を持つ。
  const onRevealRef = useRef(onReveal);
  onRevealRef.current = onReveal;

  useEffect(() => {
    if (revealed) onRevealRef.current?.();
  }, [revealed]);

  if (!spoiler) return <>{children}</>;

  return (
    <>
      {!revealed && (
        <div className="border border-solid border-border rounded px-4 py-6 flex flex-col items-center gap-3">
          <p className="text-fg-subtle text-sm">ネタバレを含む</p>
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="text-sm border border-solid border-border px-3 py-1 rounded cursor-pointer"
          >
            表示する
          </button>
        </div>
      )}
      <div hidden={!revealed} className="space-y-1">
        {children}
      </div>
    </>
  );
};
