import React from "react";
import { timelineTileImageSources } from "@/utils/listImage";

// 画像の上に題を重ねる正方形タイル。見た目は記事詳細の関連記事 (RelatedPages) と揃えてある。
// 画像の無いもの (druck) はマークを置いて、タイルの並びを崩さない。
export const Tile = ({
  href,
  label,
  image,
}: {
  href: string;
  label: string;
  image: string | null;
}) => (
  <a
    href={href}
    className="relative block aspect-square overflow-hidden rounded bg-brand transition-shadow hover:shadow-md"
  >
    {image ? (
      <img
        {...timelineTileImageSources(image)}
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
        {label}
      </div>
    </div>
  </a>
);
