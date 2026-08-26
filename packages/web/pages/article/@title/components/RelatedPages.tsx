import React from "react";
import { tileImageSources } from "@/utils/listImage";

export const RelatedPages: React.FC<{
  related: { title: string; image: string | null }[];
}> = ({ related }) => {
  if (related.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="text-lg font-bold mb-3">似てるかもしれんページ</h2>
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {related.map((r) => (
          <li key={r.title}>
            <a
              href={`/pages/${encodeURIComponent(r.title)}`}
              className="relative block aspect-square overflow-hidden rounded bg-[#82221c] transition-shadow hover:shadow-md"
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
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-2 pt-10 pb-2">
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
