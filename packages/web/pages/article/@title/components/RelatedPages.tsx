import React from "react";

export const RelatedPages: React.FC<{
  related: { title: string }[];
}> = ({ related }) => {
  // 候補が 0 件の article が全体の 7% ある。その場合は見出しごと出さない。
  if (related.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="text-lg font-bold mb-2">関連記事</h2>
      <ul>
        {related.map((r) => (
          <li key={r.title} className="my-2">
            <a
              href={`/pages/${encodeURIComponent(r.title)}`}
              className="underline"
            >
              {r.title}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
};
