// clip-semble の純粋な部分。Margin 形式に変換済みの clip を Semble (network.cosmik.*) の record にする。
import { tid, type ClipNoteItem, type Write } from "./clipMarginWrites.ts";

export const CARD = "network.cosmik.card";
export const LINK = "network.cosmik.collectionLink";

// noteContent.text の上限。lexicon の maxLength は UTF-8 のバイト数。
const NOTE_MAX_BYTES = 10000;
// URL カードと NOTE カードは同じ collection に入るので、clock id の最上位 bit で分ける。
const NOTE_CLOCK_BIT = 512;
const CLIP_CLOCK_MASK = 511;

export type StrongRef = { readonly uri: string; readonly cid: string };

export type SembleClip = {
  readonly clipId: number;
  readonly createdAt: string;
  readonly url: string;
  readonly title?: string;
  readonly text?: string;
  readonly truncated: boolean;
};

type MarginShape = {
  readonly createdAt: string;
  readonly target?: {
    readonly source?: string;
    readonly title?: string;
    readonly selector?: { readonly exact?: string };
  };
  readonly body?: { readonly value?: string };
  readonly tags?: readonly string[];
};

const encoder = new TextEncoder();

/** UTF-8 で max バイトに収まるところまで、文字の途中で切らずに詰める */
export function clampBytes(
  text: string,
  max: number,
): { readonly text: string; readonly truncated: boolean } {
  if (encoder.encode(text).length <= max) return { text, truncated: false };
  const kept = Array.from(text).reduce(
    (acc, ch) => {
      if (acc.full) return acc;
      const bytes = acc.bytes + encoder.encode(ch).length;
      return bytes > max
        ? { ...acc, full: true }
        : { text: acc.text + ch, bytes, full: false };
    },
    { text: "", bytes: 0, full: false },
  );
  return { text: kept.text, truncated: true };
}

/** 引用は `> ` を付けた行、その後に本文、最後にタグを #tag で並べる */
export function noteText(note: MarginShape): string {
  const quote = note.target?.selector?.exact
    ?.split("\n")
    .map((l) => `> ${l}`)
    .join("\n");
  const tags = (note.tags ?? []).map((t) => `#${t}`).join(" ");
  return [quote, note.body?.value, tags]
    .filter((p): p is string => p !== undefined && p !== "")
    .join("\n\n");
}

export function toSembleClip(item: ClipNoteItem): SembleClip | null {
  const note = item.note as MarginShape | undefined;
  const url = note?.target?.source;
  if (!note || !url) return null;
  const { text, truncated } = clampBytes(noteText(note), NOTE_MAX_BYTES);
  return {
    clipId: item.clipId,
    createdAt: note.createdAt,
    url,
    title: note.target?.title,
    text: text === "" ? undefined : text,
    truncated,
  };
}

export const urlCardRkey = (c: SembleClip): string =>
  tid(c.createdAt, c.clipId & CLIP_CLOCK_MASK);

export const noteCardRkey = (c: SembleClip): string =>
  tid(c.createdAt, (c.clipId & CLIP_CLOCK_MASK) | NOTE_CLOCK_BIT);

const update = (
  collection: string,
  rkey: string,
  value: Readonly<Record<string, unknown>>,
): Write => ({
  $type: "com.atproto.repo.applyWrites#update",
  collection,
  rkey,
  value: { $type: collection, ...value },
});

const remove = (collection: string, rkey: string): Write => ({
  $type: "com.atproto.repo.applyWrites#delete",
  collection,
  rkey,
});

export function urlCardWrite(c: SembleClip): Write {
  const metadata = c.title
    ? { metadata: { $type: `${CARD}#urlMetadata`, title: c.title } }
    : {};
  return update(CARD, urlCardRkey(c), {
    type: "URL",
    content: { $type: `${CARD}#urlContent`, url: c.url, ...metadata },
    createdAt: c.createdAt,
  });
}

/** URL カードを書いた後に積む。NOTE カード (本文があるときだけ) とコレクションへの link */
export function followUpWrites(
  c: SembleClip,
  urlCard: StrongRef,
  collection: StrongRef,
  did: string,
): readonly Write[] {
  const note = c.text
    ? [
        update(CARD, noteCardRkey(c), {
          type: "NOTE",
          content: { $type: `${CARD}#noteContent`, text: c.text },
          url: c.url,
          parentCard: urlCard,
          createdAt: c.createdAt,
        }),
      ]
    : [];
  const link = update(LINK, urlCardRkey(c), {
    collection,
    card: urlCard,
    addedBy: did,
    addedAt: c.createdAt,
    createdAt: c.createdAt,
  });
  return [...note, link];
}

/** clip ごとに書いたものを消す。無い record を消すと PDS が弾くので NOTE は本文があるときだけ */
export function deleteWrites(c: SembleClip): readonly Write[] {
  const note = c.text ? [remove(CARD, noteCardRkey(c))] : [];
  return [remove(LINK, urlCardRkey(c)), ...note, remove(CARD, urlCardRkey(c))];
}
