import React, { useEffect, useRef, useState } from "react";
import { readXhtmHeight, withHeightShim } from "./xhtm";

// allow-same-origin は付けない (付けると sandbox を抜けられる)
export function XhtmFrame({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(150);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      // 同じ頁の別 iframe の通知と混ざらないよう送信元で絞る
      if (e.source !== ref.current?.contentWindow) return;
      const h = readXhtmHeight(e.data);
      if (h !== null) setHeight(h);
    };
    window.addEventListener("message", onMessage);
    // hydration 前に届いた通知を取りこぼしたときのため、測り直しを頼む
    ref.current?.contentWindow?.postMessage({ xhtmMeasure: true }, "*");
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <iframe
      ref={ref}
      srcDoc={withHeightShim(html)}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      title="埋め込み HTML"
      style={{ width: "100%", height, border: 0 }}
    />
  );
}
