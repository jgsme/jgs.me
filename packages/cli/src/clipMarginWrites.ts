// clip-margin の純粋な部分。rkey の採番と applyWrites に積む中身を組む。

export type MarginNote = {
  readonly $type: "at.margin.note";
  readonly createdAt: string;
  readonly [key: string]: unknown;
};

export type ClipNoteItem = {
  readonly clipId: number;
  readonly title: string;
  readonly note?: MarginNote;
  readonly warnings?: readonly string[];
  readonly skip?: string;
};

export type Write =
  | {
      readonly $type: "com.atproto.repo.applyWrites#update";
      readonly collection: string;
      readonly rkey: string;
      readonly value: Readonly<Record<string, unknown>>;
    }
  | {
      readonly $type: "com.atproto.repo.applyWrites#delete";
      readonly collection: string;
      readonly rkey: string;
    };

export const NOTE_COLLECTION = "at.margin.note";
export const ITEM_COLLECTION = "at.margin.collectionItem";

const TID_ALPHABET = "234567abcdefghijklmnopqrstuvwxyz";
const TID_LENGTH = 13;
const TID_CHAR_BITS = 5n;
const TID_CHAR_MASK = 31n;
const CLOCK_BITS = 10n;
const CLOCK_MASK = 1023;
const MICROS_PER_MS = 1000n;

/** createdAt の時刻と 10 bit の clock id から TID を作る */
export function tid(createdAt: string, clock: number): string {
  const ms = Date.parse(createdAt);
  if (Number.isNaN(ms)) throw new Error(`createdAt を読めない: ${createdAt}`);
  const n =
    ((BigInt(ms) * MICROS_PER_MS) << CLOCK_BITS) | BigInt(clock & CLOCK_MASK);
  return Array.from({ length: TID_LENGTH }, (_, i) => {
    const shift = BigInt(TID_LENGTH - 1 - i) * TID_CHAR_BITS;
    return TID_ALPHABET[Number((n >> shift) & TID_CHAR_MASK)];
  }).join("");
}

/**
 * clip から決まる TID。時刻は clip の createdAt、clock id は clip id の下位 10 bit。
 * 同じ clip は何度流しても同じ rkey になるので、update (upsert) で上書きするだけで済む
 */
export function clipTid(createdAt: string, clipId: number): string {
  return tid(createdAt, clipId);
}

/** note 1 件と、それを clips コレクションに入れる collectionItem 1 件 */
export function writesFor(
  item: ClipNoteItem,
  did: string,
  collectionUri: string,
): readonly Write[] {
  const note = item.note;
  if (!note) return [];
  const rkey = clipTid(note.createdAt, item.clipId);
  return [
    {
      $type: "com.atproto.repo.applyWrites#update",
      collection: NOTE_COLLECTION,
      rkey,
      value: note,
    },
    {
      $type: "com.atproto.repo.applyWrites#update",
      collection: ITEM_COLLECTION,
      rkey,
      value: {
        $type: ITEM_COLLECTION,
        annotation: `at://${did}/${NOTE_COLLECTION}/${rkey}`,
        collection: collectionUri,
        createdAt: note.createdAt,
      },
    },
  ];
}

/**
 * writesFor で書いた 2 件を消す。同じ値で update しても op が中身の変わらない
 * update になり Jetstream に流れないので、Margin に届け直すときは一度消してから書く
 */
export function deletesFor(item: ClipNoteItem): readonly Write[] {
  const note = item.note;
  if (!note) return [];
  const rkey = clipTid(note.createdAt, item.clipId);
  return [ITEM_COLLECTION, NOTE_COLLECTION].map((collection) => ({
    $type: "com.atproto.repo.applyWrites#delete",
    collection,
    rkey,
  }));
}

/** 人が見る行。skip と warnings があるものだけ */
export function reportLines(items: readonly ClipNoteItem[]): readonly string[] {
  return items.flatMap((i) => {
    const head = `c/${i.clipId}\t${i.title}`;
    if (i.skip !== undefined) return [`skip\t${head}\t${i.skip}`];
    if (i.warnings && i.warnings.length > 0) {
      return [`warn\t${head}\t${i.warnings.join(" / ")}`];
    }
    return [];
  });
}
