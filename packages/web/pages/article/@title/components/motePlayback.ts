import type { MoteView } from "@/server/mote";

export interface VideoAttrs {
  readonly src: string;
  readonly poster: string | undefined;
  readonly controls: boolean;
  readonly loop: boolean;
  readonly muted: boolean;
  readonly playsInline: true;
  readonly preload: "none";
  readonly playWhenVisible: boolean;
  readonly aspectRatio: string | undefined;
}

// autoplay の動画は record の muted にかかわらず無音。音は勝手に鳴らさない。
export function videoAttrs(view: MoteView): VideoAttrs {
  return {
    src: view.videoUrl,
    poster: view.posterUrl ?? undefined,
    controls: !view.playback.autoplay,
    loop: view.playback.loop,
    muted: view.playback.autoplay || view.playback.muted,
    playsInline: true,
    preload: "none",
    playWhenVisible: view.playback.autoplay,
    aspectRatio: view.aspectRatio
      ? `${view.aspectRatio.width} / ${view.aspectRatio.height}`
      : undefined,
  };
}

export interface PlayableElement {
  muted: boolean;
  play(): Promise<void>;
  pause(): void;
}

// video 要素の再生を約束どおりに動かす。返り値は片付け。
// DOM のグローバルには触れず、IntersectionObserver は引数で受ける。
export function attachPlayback(
  el: PlayableElement & Element,
  attrs: Pick<VideoAttrs, "muted" | "playWhenVisible">,
  deps: {
    IntersectionObserver: typeof IntersectionObserver | undefined;
    onNeedControls: () => void;
  },
): () => void {
  // React は muted を property に確実には反映しないので、play() の前に自分で立てる
  el.muted = attrs.muted;
  if (!attrs.playWhenVisible) return () => {};
  const Observer = deps.IntersectionObserver;
  if (!Observer) {
    deps.onNeedControls();
    return () => {};
  }
  const play = async () => {
    try {
      await el.play();
    } catch {
      deps.onNeedControls();
    }
  };
  const observer = new Observer((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) void play();
      else el.pause();
    }
  });
  observer.observe(el);
  return () => observer.disconnect();
}
