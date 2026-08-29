import React from "react";
import { tileImageSources } from "@/utils/listImage";

type Clip = {
  id: number;
  title: string;
  image: string | null;
};

// index の記事一覧に差し込むコンパクトな clip 一覧。
// 記事カードは h-[300px] と大きいので、こちらは小さいタイルの
// グリッドにして密度で見分けが付くようにする。
export const ClipsSection = ({ clips }: { clips: Clip[] }) => {
  if (clips.length === 0) return null;

  return (
    <section className="my-12 border-y border-black/10 py-6">
      <h2 className="font-bold text-[0.9rem] text-black/50 mb-3">Clips</h2>
      <ul className="grid grid-cols-3 gap-3">
        {clips.map((clip) => (
          <li key={clip.id}>
            <a href={`/pages/${encodeURIComponent(clip.title)}`}>
              {clip.image ? (
                <img
                  {...tileImageSources(clip.image)}
                  alt={clip.title}
                  className="rounded aspect-square object-cover w-full"
                  loading="lazy"
                />
              ) : (
                <div className="rounded aspect-square bg-black/[0.04]" />
              )}
              <div className="mt-1 text-[0.8rem] line-clamp-2">
                {clip.title}
              </div>
            </a>
          </li>
        ))}
      </ul>
      <a href="/clips" className="block mt-4 underline text-[0.9rem]">
        クリップをもっと見る
      </a>
    </section>
  );
};
