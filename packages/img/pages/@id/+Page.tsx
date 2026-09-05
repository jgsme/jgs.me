import { useData } from "vike-react/useData";
import type { ImageData } from "./+data";

export default function Page() {
  const d = useData<ImageData>();

  return (
    <>
      {/* alt は空。装飾ではなく本体だが、説明できる文言をこちらは持っていない。
          出典の題は下のリンクで読めるので、そこを重ねても読み上げが冗長になるだけ。 */}
      <img
        src={d.direct}
        alt=""
        width={d.width ?? undefined}
        height={d.height ?? undefined}
        className="w-full h-auto rounded"
      />

      {d.source && (
        <p className="mt-4">
          <span className="text-fg-subtle">from </span>
          <a href={d.source.href} className="text-link">
            {d.source.label}
          </a>
        </p>
      )}

      <p className="mt-4 text-sm text-fg-subtle">
        {d.created}
        <br />
        {/* 直リンクは記事に貼る用途で選択してコピーする。 */}
        <code className="select-all">{d.direct}</code>
      </p>
    </>
  );
}
