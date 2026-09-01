import React from "react";
import { useEffect, useState } from "react";
import type { ReactionJSON } from "@/server/routes/reactions";
import { thumbURL } from "@/utils/thumbURL";
import { splitReactions } from "./reactionGroups";

type Reaction = ReactionJSON;

// 記事本体は SSR されて /pages/* が s-maxage=86400 でエッジに載る。反応をそこに
// 含めるとキャッシュが切れるまで増えないので、この島だけクライアントで取り直す。
// clientOnly 経由で読まれる前提 (+Page.tsx) なので default export。
export default function Reactions({ pageId }: { pageId: number | null }) {
  const [reactions, setReactions] = useState<Reaction[]>([]);

  useEffect(() => {
    if (pageId === null) return;

    // 表示中にアンマウントされたら state を触らない。
    let alive = true;
    const ac = new AbortController();

    (async () => {
      try {
        const res = await fetch(`/api/reactions/${pageId}`, {
          signal: ac.signal,
        });
        if (!res.ok) return;
        const json = (await res.json()) as { reactions: Reaction[] };
        if (alive) setReactions(json.reactions);
      } catch {
        // 反応が取れなくても記事は読める。黙って出さない。
      }
    })();

    return () => {
      alive = false;
      ac.abort();
    };
  }, [pageId]);

  if (reactions.length === 0) return null;

  // ActivityPub 経由と Webmention 経由を区別しない。
  // 読者にとって「Mastodon の Like」と「IndieWeb の u-like-of」は同じもの。
  const { cards, glyphs } = splitReactions(reactions);

  return (
    <section className="mt-12 border-t pt-6">
      <h2 className="text-sm font-bold mb-4">反応</h2>

      {glyphs.length > 0 && (
        <ul className="flex flex-wrap gap-2 mb-6 list-none p-0">
          {glyphs.map((r) => (
            <li key={r.id}>
              <a
                href={r.actorURL ?? "#"}
                rel="noopener noreferrer nofollow"
                target="_blank"
                title={`${r.actorName ?? "誰か"} — ${label(r)}`}
                className="inline-flex items-center gap-1 text-xs"
              >
                <Avatar icon={r.actorIcon} size={24} />
                <span>{r.emoji ?? glyph(r.kind)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {cards.length > 0 && (
        <ul className="list-none p-0 space-y-3">
          {cards.map((r) => (
            <Card key={r.id} r={r} />
          ))}
        </ul>
      )}
    </section>
  );
}

// 反応元が分かるものはカードで出す。本文 (content) は Webmention 経由では
// 取っていないので、題と URL だけでも中身のある箱になるようにしてある。
function Card({ r }: { r: Reaction }) {
  // content は外部由来。タグを落としてテキストだけ出す。
  const text = stripTags(r.content ?? "");
  const href = r.sourceURL ?? r.actorURL;

  return (
    <li className="flex items-start gap-3 border rounded-lg p-3">
      <Avatar icon={r.actorIcon} size={32} />
      <div className="min-w-0 flex-1">
        <p className="text-xs">
          <a
            href={r.actorURL ?? "#"}
            rel="noopener noreferrer nofollow"
            target="_blank"
            className="font-bold"
          >
            {r.actorName ?? "誰か"}
          </a>
          <span className="ml-1 text-gray-500">{label(r)}</span>
        </p>

        {r.sourceTitle && href && (
          <a
            href={href}
            rel="noopener noreferrer nofollow"
            target="_blank"
            className="block text-sm mt-1"
          >
            {r.sourceTitle}
          </a>
        )}

        {text !== "" && <p className="text-sm mt-1">{text}</p>}

        {href && (
          <span className="block text-xs text-gray-400 break-all mt-1">
            {href}
          </span>
        )}
      </div>
    </li>
  );
}

// R2 に取り込んだアイコンは Image Transformations で縮小する。それ以外
// (ActivityPub 由来の直リンク) は thumbURL が素通しする。
function Avatar({ icon, size }: { icon: string | null; size: number }) {
  if (!icon) {
    return (
      <span
        className="inline-block rounded-full bg-gray-300 flex-none"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <img
      src={thumbURL(icon, size * 2)}
      alt=""
      width={size}
      height={size}
      className="rounded-full flex-none"
      loading="lazy"
    />
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
