import { useData } from "vike-react/useData";
import { isVideoExt } from "@jigsaw/media";
import type { ImageData } from "./+data";

export default function Page() {
  const d = useData<ImageData>();

  if (isVideoExt(d.ext)) {
    return (
      <>
        {/* 自動再生しない・ループしない。操作は controls に任せる。 */}
        <video
          src={d.direct}
          controls
          playsInline
          preload="metadata"
          width={d.width ?? undefined}
          height={d.height ?? undefined}
          className="w-full h-auto rounded"
        />

        <p className="mt-4 text-sm text-fg-subtle">
          {d.created}
          <br />
          <code className="select-all">{d.direct}</code>
        </p>
      </>
    );
  }

  return (
    <>
      {/* alt は空。装飾ではなく本体だが、説明できる文言をこちらは持っていない。
          出典の題は他所が付けた題で、画像の中身を説明しているとは限らない。 */}
      <img
        src={d.direct}
        alt=""
        width={d.width ?? undefined}
        height={d.height ?? undefined}
        className="w-full h-auto rounded"
      />

      <p className="mt-4 text-sm text-fg-subtle">
        {d.created}
        <br />
        {/* 直リンクは記事に貼る用途で選択してコピーする。 */}
        <code className="select-all">{d.direct}</code>
      </p>
    </>
  );
}
