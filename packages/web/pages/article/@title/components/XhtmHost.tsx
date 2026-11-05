import React, { createContext, useEffect, useMemo, useRef } from "react";
import {
  XHTM_HOST_CLASS,
  loadLib,
  runXhtmPart,
  type XhtmPart,
} from "./xhtmPart";
import type { XhtmParts } from "../xhtmParts";

// +data が読んだ部品 (キー → 部品)。
export const XhtmPartsContext = createContext<XhtmParts>({});

// code:xhtm の部品。styles と body は入れ物の innerHTML に描き、scripts は
// effect で走らせて cleanup で片付ける (xhtmPart.ts の runXhtmPart)。
// __html を渡す object を useMemo で固定する理由は HtmlBody.tsx と同じ
// (再描画で入れ直すと script が組んだ DOM が消える)。
// memo と effect は partKey だけに依存させる。部品の中身はキーで決まり、
// part の object が変わっても同じ中身なら React は innerHTML を入れ直さないので、
// object で走らせ直すと script が組んだ DOM の上でもう一度走る。
// キーが変わったら呼ぶ側 (ScrapboxBlock) が key で作り直す。
export const XhtmHost: React.FC<{ partKey: string; part: XhtmPart }> = ({
  partKey,
  part,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inner = useMemo(
    () => ({ __html: part.styles.join("") + part.body }),
    [partKey],
  );

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    // libs を読み終える前に unmount されたら scripts を呼ばない。
    const ac = new AbortController();
    const running = runXhtmPart(root, part, loadLib, ac.signal);
    return () => {
      ac.abort();
      void (async () => (await running)())();
    };
  }, [partKey]);

  return (
    <div
      ref={ref}
      className={XHTM_HOST_CLASS}
      dangerouslySetInnerHTML={inner}
    />
  );
};
