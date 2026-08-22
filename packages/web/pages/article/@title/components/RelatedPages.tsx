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
              className="relative block aspect-square overflow-hidden rounded bg-[#82221c] transition-shadow hover:shadow-md"
            >
              {r.image ? (
                <img
                  src={thumbURL(r.image)}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                // サムネが無いページ。OG 画像 (1200x630) は幅いっぱいにタイトルを
                // 置くレイアウトなので、正方形に切ると文字が両端で切れて読めない。
                // 地をブランド色にしてマークを薄く敷くだけにする。
                <img
                  src="/mark.svg"
                  alt=""
                  className="absolute left-1/2 top-1/2 w-1/3 -translate-x-1/2 -translate-y-1/2 opacity-25"
                />
              )}
              {/* グラデは画像の上に重ねる帯。pt を厚めに取って、画像が明るくても
                  タイトルの下地が確保される。 */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-2 pt-10 pb-2">
                {/* line-clamp は overflow を padding box で切るので、padding を
                    持つ外側と分ける。同じ要素に付けると 4 行目が下に覗く。 */}
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
