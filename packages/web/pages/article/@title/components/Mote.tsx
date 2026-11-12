import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Motes, MoteView } from "@/server/mote";
import { attachPlayback, videoAttrs } from "./motePlayback";

export const MotesContext = createContext<Motes>({});

export function useMote(url: string): MoteView | undefined {
  return useContext(MotesContext)[url];
}

// 縦長の動画が画面の高さの 8 割を超えないよう、幅を高さから決める。
// 比が分かっていれば枠は SSR の時点で確定し、poster や mp4 が届いても動かない。
const MAX_HEIGHT_VH = 80;

export const MoteEmbed: React.FC<{ view: MoteView }> = ({ view }) => {
  const attrs = videoAttrs(view);
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [needControls, setNeedControls] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return attachPlayback(
      el,
      { muted: attrs.muted, playWhenVisible: attrs.playWhenVisible },
      {
        IntersectionObserver:
          typeof IntersectionObserver === "undefined"
            ? undefined
            : IntersectionObserver,
        onNeedControls: () => setNeedControls(true),
        onFailed: () => setFailed(true),
      },
    );
  }, [attrs.muted, attrs.playWhenVisible, failed]);

  if (failed) {
    return (
      <div className="my-4">
        <a
          href={view.pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-link hover:underline"
        >
          {view.title ?? view.pageUrl}
        </a>
      </div>
    );
  }

  const ratio = view.aspectRatio;
  const style: React.CSSProperties = ratio
    ? {
        maxHeight: `${MAX_HEIGHT_VH}vh`,
        aspectRatio: attrs.aspectRatio,
        width: `min(100%, ${(MAX_HEIGHT_VH * ratio.width) / ratio.height}vh)`,
      }
    : { maxHeight: `${MAX_HEIGHT_VH}vh` };

  return (
    <div className="my-4">
      <video
        ref={ref}
        className="block mx-auto max-w-full rounded bg-surface-strong object-contain"
        src={attrs.src}
        poster={attrs.poster}
        controls={attrs.controls || needControls}
        loop={attrs.loop}
        muted={attrs.muted}
        playsInline={attrs.playsInline}
        preload={attrs.preload}
        aria-label={view.alt ?? undefined}
        style={style}
        onError={() => setFailed(true)}
      />
    </div>
  );
};

// +data.ts で取れた mote があれば video、無ければ普通のリンク。
export const MoteLink: React.FC<{
  url: string;
  href: string;
  label: string;
}> = ({ url, href, label }) => {
  const view = useMote(url);
  // key で作り直す — vike はクライアント遷移でページを key 無しで描き直すので、
  // 同じ位置に別の mote が来ると failed / controls / observer / 要素の muted を
  // 引き継いでしまう。
  if (view) return <MoteEmbed key={view.videoUrl} view={view} />;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-link hover:underline"
    >
      {label}
    </a>
  );
};
