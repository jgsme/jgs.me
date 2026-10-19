import React from "react";
import { tileImageSources } from "@/utils/listImage";

export type Tile = {
  key: string | number;
  href: string;
  label: string;
  image: string | null;
};

// index の記事一覧に差し込む clip / zet の一覧。
// 記事カードは h-96 と大きいので、こちらは正方形タイルのグリッドにして
// 密度で見分けが付くようにする。タイルの見た目は記事詳細の関連記事
// (RelatedPages) と揃えてある。
export const TileSection = ({
  heading,
  tiles,
  moreHref,
  moreLabel,
}: {
  heading: string;
  tiles: Tile[];
  moreHref: string;
  moreLabel: string;
}) => {
  if (tiles.length === 0) return null;

  return (
    <section className="py-6">
      <h2 className="text-lg font-bold mb-3">{heading}</h2>
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {tiles.map((tile) => (
          <li key={tile.key}>
            <a
              href={tile.href}
              className="relative block aspect-square overflow-hidden rounded bg-brand transition-shadow hover:shadow-md"
            >
              {tile.image ? (
                <img
                  {...tileImageSources(tile.image)}
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
                  {tile.label}
                </div>
              </div>
            </a>
          </li>
        ))}
      </ul>
      <a href={moreHref} className="block mt-4 underline text-sm">
        {moreLabel}
      </a>
    </section>
  );
};
