import React from "react";

type Reaction = {
  id: string;
  kind: string;
  emoji: string | null;
  actorName: string | null;
  actorURL: string | null;
  actorIcon: string | null;
  content: string | null;
  created: string;
};

// ActivityPub 経由と Webmention 経由を区別しない。
// 読者にとって「Mastodon の Like」と「IndieWeb の u-like-of」は同じもの。
export function Reactions({ reactions }: { reactions: Reaction[] }) {
  if (reactions.length === 0) return null;

  const replies = reactions.filter((r) => r.kind === "reply");
  const others = reactions.filter((r) => r.kind !== "reply");

  return (
    <section className="mt-12 border-t pt-6">
      <h2 className="text-sm font-bold mb-4">反応</h2>

      {others.length > 0 && (
        <ul className="flex flex-wrap gap-2 mb-6 list-none p-0">
          {others.map((r) => (
            <li key={r.id}>
              <a
                href={r.actorURL ?? "#"}
                rel="noopener noreferrer nofollow"
                target="_blank"
                title={`${r.actorName ?? "誰か"} — ${label(r)}`}
                className="inline-flex items-center gap-1 text-xs"
              >
                {r.actorIcon ? (
                  <img
                    src={r.actorIcon}
                    alt=""
                    width={24}
                    height={24}
                    className="rounded-full"
                    loading="lazy"
                  />
                ) : (
                  <span className="inline-block w-6 h-6 rounded-full bg-gray-300" />
                )}
                <span>{r.emoji ?? glyph(r.kind)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {replies.length > 0 && (
        <ul className="list-none p-0 space-y-4">
          {replies.map((r) => {
            // content は外部由来。タグを落としてテキストだけ出す。
            // Webmention 由来の reply は content を持たない (計画6 の
            // extractMf2 は e-content を取らない) ため、空なら段落ごと出さない。
            const text = stripTags(r.content ?? "");
            return (
              <li key={r.id}>
                <a
                  href={r.actorURL ?? "#"}
                  rel="noopener noreferrer nofollow"
                  target="_blank"
                  className="text-xs font-bold"
                >
                  {r.actorName ?? "誰か"}
                </a>
                {text !== "" && <p className="text-sm mt-1">{text}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// kind は計画6 の Webmention 経由でも同じ値が入る。
// bookmark は mention に丸められて来る (計画6 Task 4)。
function glyph(kind: string): string {
  if (kind === "like") return "★";
  if (kind === "announce") return "⇄";
  if (kind === "mention") return "◇";
  return "・";
}

function label(r: Reaction): string {
  if (r.kind === "like") return "いいね";
  if (r.kind === "announce") return "ブースト";
  if (r.kind === "emoji") return `リアクション ${r.emoji ?? ""}`;
  if (r.kind === "mention") return "言及";
  if (r.kind === "reply") return "返信";
  // 未知の kind をそのまま出さない。kind が増えても英語が漏れない。
  return "反応";
}

// 外部サイトから来た HTML をそのまま描画しない。
// 反応の本文は要約が読めれば十分なのでテキストに落とす。
function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}
