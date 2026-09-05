import React from "react";
import { tileImageSources } from "@/utils/listImage";

type Clip = {
  id: number;
  title: string;
  image: string | null;
};

// index の記事一覧に差し込む clip 一覧。
// 記事カードは h-96 と大きいので、こちらは正方形タイルのグリッドにして
// 密度で見分けが付くようにする。タイルの見た目は記事詳細の関連記事
// (RelatedPages) と揃えてある。
export const ClipsSection = ({ clips }: { clips: Clip[] }) => {
  if (clips.length === 0) return null;

  return (
    <section className="my-12 border-y border-black/10 py-6">
      <h2 className="text-lg font-bold mb-3">クリップ</h2>
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {clips.map((clip) => (
          <li key={clip.id}>
            <a
              href={`/pages/${encodeURIComponent(clip.title)}`}
              className="relative block aspect-square overflow-hidden rounded bg-brand transition-shadow hover:shadow-md"
            >
              {clip.image ? (
                <img
                  {...tileImageSources(clip.image)}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <img
                  src="/mark.svg"
                  alt=""
                  className="absolute left-1/2 top-1/2 w-1/3 -translate-x-1/2 -translate-y-1/2 opacity-25"
                />
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-2 pt-12 pb-2">
                <div className="line-clamp-3 text-sm font-bold leading-snug text-white break-words">
                  {clip.title}
                </div>
              </div>
            </a>
          </li>
        ))}
      </ul>
      <a href="/clips" className="block mt-4 underline text-sm">
        クリップをもっと見る
      </a>
    </section>
  );
};
