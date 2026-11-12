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
  // 読み込みに失敗していれば null 以外 (HTMLMediaElement.error)
  readonly error: unknown;
  play(): Promise<void>;
  pause(): void;
}

// 自分の pause() で中断された play() は AbortError で reject される。
// 再生を拒否されたわけではない。
function isAbort(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { name?: unknown }).name === "AbortError"
  );
}

// video 要素の再生を約束どおりに動かす。返り値は片付け。
// DOM のグローバルには触れず、IntersectionObserver は引数で受ける。
export function attachPlayback(
  el: PlayableElement & Element,
  attrs: Pick<VideoAttrs, "muted" | "playWhenVisible">,
  deps: {
    IntersectionObserver: typeof IntersectionObserver | undefined;
    onNeedControls: () => void;
    // hydration より前に読み込みに失敗していた (onError を取り逃した) とき
    onFailed: () => void;
  },
): () => void {
  // React は muted を property に確実には反映しないので、play() の前に自分で立てる
  el.muted = attrs.muted;
  if (el.error != null) {
    deps.onFailed();
    return () => {};
  }
  if (!attrs.playWhenVisible) return () => {};
  const Observer = deps.IntersectionObserver;
  if (!Observer) {
    deps.onNeedControls();
    return () => {};
  }
  // controls を出したら再生は読者のもの。以後 observer から play() しない
  // (読者が音を出して止めた動画を、画面に入り直したときに鳴らさないため)。
  let handedOver = false;
  const play = async () => {
    try {
      await el.play();
    } catch (e) {
      if (isAbort(e) || handedOver) return;
      handedOver = true;
      observer.disconnect();
      deps.onNeedControls();
    }
  };
  const observer = new Observer((entries) => {
    if (handedOver) return;
    for (const entry of entries) {
      if (entry.isIntersecting) void play();
      else el.pause();
    }
  });
  observer.observe(el);
  return () => observer.disconnect();
}
