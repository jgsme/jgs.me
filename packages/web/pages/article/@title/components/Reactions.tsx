import React from "react";
import { useEffect, useState } from "react";
import type { ReactionJSON } from "@/server/routes/reactions";
import { thumbURL } from "@/utils/thumbURL";
import { cardSource, splitReactions } from "./reactionGroups";

type Reaction = ReactionJSON;

export default function Reactions({ pageId }: { pageId: number | null }) {
  const [reactions, setReactions] = useState<Reaction[]>([]);

  useEffect(() => {
    if (pageId === null) return;

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

  const { cards, glyphs } = splitReactions(reactions);

  return (
    <section className="mt-12 border-t pt-6">
      <h2 className="text-lg font-bold mb-4">メンション</h2>

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

function Card({ r }: { r: Reaction }) {
  const text = stripTags(r.content ?? "");
  const source = cardSource(r);

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
        </p>

        {source?.title && (
          <a
            href={source.url}
            rel="noopener noreferrer nofollow"
            target="_blank"
            className="block text-sm mt-1"
          >
            {source.title}
          </a>
        )}

        {text !== "" && <p className="text-sm mt-1">{text}</p>}

        {/* 題があるときは上のリンクが主で、こちらは行き先を見せる補助。
            ActivityPub の返信は題が無いのでこれが唯一のリンクになる。 */}
        {source && (
          <a
            href={source.url}
            rel="noopener noreferrer nofollow"
            target="_blank"
            className="block text-xs text-fg-subtle break-all mt-1"
          >
            {source.url}
          </a>
        )}
      </div>

      {r.sourceImage && (
        <img
          src={thumbURL(r.sourceImage, 192)}
          alt=""
          width={96}
          height={48}
          className="rounded flex-none object-cover w-24 h-12"
          loading="lazy"
        />
      )}
    </li>
  );
}

function Avatar({ icon, size }: { icon: string | null; size: number }) {
  if (!icon) {
    return (
      <span
        className="inline-block rounded-full bg-border flex-none"
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
  return "反応";
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}
