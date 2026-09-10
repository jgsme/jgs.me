import React from "react";
import { tileImageSources } from "@/utils/listImage";

// 記事ページの下に出すページカードの並び。「似てるかもしれんページ」
// (similarity) と「関連ページ」(被リンク) の両方が同じ見た目なので、
// 見出しだけ差し替えて使い回す。
export const PageTileGrid: React.FC<{
  heading: string;
  pages: { title: string; image: string | null }[];
}> = ({ heading, pages }) => {
  if (pages.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="text-lg font-bold mb-3">{heading}</h2>
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {pages.map((r) => (
          <li key={r.title}>
            <a
              href={`/pages/${encodeURIComponent(r.title)}`}
              className="relative block aspect-square overflow-hidden rounded bg-brand transition-shadow hover:shadow-md"
            >
              {r.image ? (
                <img
                  {...tileImageSources(r.image)}
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
                  {r.title}
                </div>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
};
