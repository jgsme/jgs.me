import React from "react";
import { thumbURL } from "@/utils/thumbURL";

export const RelatedPages: React.FC<{
  related: { title: string; image: string | null }[];
}> = ({ related }) => {
  // 候補が 0 件の article が全体の 7% ある。その場合は見出しごと出さない。
  if (related.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="text-lg font-bold mb-3">関連記事</h2>
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {related.map((r) => (
          <li key={r.title}>
            <a
              href={`/pages/${encodeURIComponent(r.title)}`}
              className="flex flex-col aspect-square overflow-hidden rounded border border-black/10 bg-white transition-shadow hover:shadow-md"
            >
              {/* Scrapbox のカードと同じで、タイトルが上・画像が残りを埋める。
                  画像が無いときはタイトルだけがカード全体に広がる。 */}
              <div className="shrink-0 px-2 pt-2 mb-1 text-sm font-bold leading-snug line-clamp-3 break-words">
                {r.title}
              </div>
              {r.image && (
                <img
                  src={thumbURL(r.image)}
                  alt=""
                  className="min-h-0 grow w-full object-cover"
                  loading="lazy"
                />
              )}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
};
