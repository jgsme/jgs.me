import { sameURL } from "./sameurl";

export type Extracted = {
  // source に target へのリンクが実在するか。Webmention 仕様が要求する検証。
  linksTo: boolean;
  kind: "reply" | "like" | "repost" | "bookmark" | "mention";
  authorName: string | null;
  authorURL: string | null;
  authorPhoto: string | null;
  // カード表示用。h-entry の p-name → <title> → ホスト名 の順で決まる。
  title: string;
  // カードのサムネ。og:image。mf2 で記事の画像を宣言している相手は
  // 実在しなかったので u-featured / entry の u-photo は見ない。
  image: string | null;
};

// 外部由来の文字列をそのまま DB に入れない。
export const MAX_TITLE_LENGTH = 200;

// 題や名前に実際に現れるものだけ。ここに無い実体は解かずに残す。
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
};

// HTMLRewriter の text チャンクは実体参照を解かずに渡してくる。素通しすると
// 題も著者名も "A &amp; B" のまま DB に入り、そのまま画面に出る。
// 置換は 1 パス。&amp;lt; は &lt; になり、< にはならない。
export function decodeEntities(s: string): string {
  return s.replace(
    /&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g,
    (whole, body: string) => {
      if (body[0] !== "#") return NAMED_ENTITIES[body] ?? whole;

      const hex = body[1] === "x" || body[1] === "X";
      const cp = Number.parseInt(
        hex ? body.slice(2) : body.slice(1),
        hex ? 16 : 10,
      );
      // 0 / 範囲外 / 単独サロゲートは文字にできない。元の文字列を残す。
      if (!Number.isFinite(cp) || cp <= 0 || cp > 0x10ffff) return whole;
      if (cp >= 0xd800 && cp <= 0xdfff) return whole;
      return String.fromCodePoint(cp);
    },
  );
}

function clean(s: string | null): string | null {
  if (s === null) return null;
  const t = s.replace(/\s+/g, " ").trim();
  return t === "" ? null : t;
}

// 反応元ページの題を決める。<title> は「記事名 - サイト名」の形が多いので、
// 相手が mf2 で題を宣言しているならそちらを信じる。
export function pickSourceTitle(
  entryName: string | null,
  docTitle: string | null,
  sourceURL: string,
): string {
  const picked = clean(entryName) ?? clean(docTitle);
  if (picked !== null) return picked.slice(0, MAX_TITLE_LENGTH);
  try {
    return new URL(sourceURL).hostname.slice(0, MAX_TITLE_LENGTH);
  } catch {
    return sourceURL.slice(0, MAX_TITLE_LENGTH);
  }
}

// og:image の候補かどうかだけを見る。property と name の両方を受けるのは、
// name= で書くジェネレータが実在するため。og:image:width のような前方一致の
// 別物を拾わないよう、完全一致で見る。
export function ogImageCandidate(
  property: string | null,
  name: string | null,
  content: string | null,
): string | null {
  const key = (property ?? name ?? "").toLowerCase();
  if (key !== "og:image") return null;
  return content ? content : null;
}

// 種別の優先順位。より具体的なものを優先する。
const RANK = { reply: 4, like: 3, repost: 2, bookmark: 1, mention: 0 } as const;

const KIND_CLASS: ReadonlyArray<[string, Extracted["kind"]]> = [
  ["u-in-reply-to", "reply"],
  ["u-like-of", "like"],
  ["u-repost-of", "repost"],
  ["u-bookmark-of", "bookmark"],
];

// onEndTag() は void 要素で例外を投げる。mf2 の class は img にも付くため必要。
const VOID = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

function classesOf(el: Element): string[] {
  const cls = el.getAttribute("class");
  return cls ? cls.split(/\s+/) : [];
}

function absolute(href: string | null, base: string): string | null {
  if (href === null) return null;
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

// text チャンクを 1 本の文字列にする唯一の口。実体参照を解くのはここだけに
// 置く。呼び出し側で更に解くと &amp;lt; が < まで落ちる。
function collapse(parts: string[]): string | null {
  const s = decodeEntities(parts.join("")).replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
}

// 完全な mf2 パーサは書かない。Webmention の受信に必要な4点だけを取る。
//   1. source に target へのリンクが実在するか
//   2. どの u-* class が target を指すか (種別判定)
//   3. p-author の name / url / photo (表示用)
//   4. 反応元ページの題 (カード表示用)
//
// クラスセレクタを使う。"*" に text ハンドラを付けると入れ子の要素ごとに
// 同じテキストチャンクが渡り、名前が二重に積まれる。
export async function extractMf2(
  html: string,
  target: string,
  baseURL: string,
): Promise<Extracted> {
  let linksTo = false;
  let best: Extracted["kind"] = "mention";

  // p-author の中にいるか。入れ子を数える。
  let authorDepth = 0;
  let authorURL: string | null = null;
  let authorPhoto: string | null = null;
  const nameParts: string[] = [];
  const cardParts: string[] = [];

  // 反応元ページの題。最初の 1 つだけ拾う。h-entry が複数ある
  // (一覧ページから送られた) 場合に後ろの記事の題で上書きしない。
  let entryNameDepth = 0;
  let entryNameDone = false;
  const entryNameParts: string[] = [];

  // <title>。svg の中にも title があるので、こちらも最初の 1 つだけ。
  let titleDepth = 0;
  let titleDone = false;
  const titleParts: string[] = [];

  let image: string | null = null;

  const rewriter = new HTMLRewriter()
    // 著者の範囲を最初に登録する。ハンドラは登録順に呼ばれるので、
    // 同じ要素に対して authorDepth が先に立つ。
    .on(".p-author", {
      element(el) {
        // <a class="p-author" href>Name</a> のように h-card を持たない形も
        // mf2 では正当。その場合も href / テキストを著者として扱う。
        if (authorURL === null) {
          authorURL = absolute(el.getAttribute("href"), baseURL);
        }
        if (VOID.has(el.tagName)) return;
        authorDepth++;
        el.onEndTag(() => {
          authorDepth--;
        });
      },
      text(t) {
        cardParts.push(t.text);
      },
    })
    .on(".p-name", {
      element(el) {
        // mf2 では img.p-name の値は alt 属性。void 要素はテキストを持たない。
        if (authorDepth > 0 && VOID.has(el.tagName)) {
          const alt = el.getAttribute("alt");
          if (alt) nameParts.push(alt);
        }
      },
      text(t) {
        if (authorDepth > 0) nameParts.push(t.text);
      },
    })
    .on(".u-url", {
      element(el) {
        if (authorDepth > 0 && authorURL === null) {
          authorURL = absolute(el.getAttribute("href"), baseURL);
        }
      },
    })
    .on(".u-photo", {
      element(el) {
        if (authorDepth > 0 && authorPhoto === null) {
          // img は src、それ以外 (a.u-photo など) は href。
          authorPhoto = absolute(
            el.getAttribute("src") ?? el.getAttribute("href"),
            baseURL,
          );
        }
      },
    })
    // 著者の p-name と同じ要素に当たることがあるので authorDepth で外す。
    // 配列が別なので、両方のハンドラが同じテキストを受け取っても混ざらない。
    .on(".h-entry .p-name", {
      element(el) {
        if (authorDepth > 0 || entryNameDone) return;
        // mf2 では img.p-name の値は alt 属性。void 要素はテキストを持たない。
        if (VOID.has(el.tagName)) {
          const alt = el.getAttribute("alt");
          if (alt) entryNameParts.push(alt);
          entryNameDone = true;
          return;
        }
        entryNameDepth++;
        el.onEndTag(() => {
          entryNameDepth--;
          if (entryNameDepth === 0) entryNameDone = true;
        });
      },
      text(t) {
        if (entryNameDepth > 0) entryNameParts.push(t.text);
      },
    })
    .on("title", {
      element(el) {
        if (titleDone) return;
        titleDepth++;
        el.onEndTag(() => {
          titleDepth--;
          if (titleDepth === 0) titleDone = true;
        });
      },
      text(t) {
        if (titleDepth > 0) titleParts.push(t.text);
      },
    })
    .on("meta[content]", {
      element(el) {
        if (image !== null) return;
        const found = ogImageCandidate(
          el.getAttribute("property"),
          el.getAttribute("name"),
          el.getAttribute("content"),
        );
        if (found !== null) image = absolute(found, baseURL);
      },
    })
    .on("a[href], link[href], area[href]", {
      element(el) {
        const href = el.getAttribute("href")!;

        // 仕様が要求するのは「source が target に言及しているか」だけ。
        // 著者カードの中かどうかは関係ない。ここを著者スコープ外に限ると、
        // 閉じ忘れた p-author 以降のリンクが丸ごと見えなくなる。
        const hitsTarget = sameURL(href, target);
        if (hitsTarget) linksTo = true;

        if (authorDepth > 0) {
          // implied url。u-url を持たない h-card のためのフォールバック。
          if (authorURL === null) authorURL = absolute(href, baseURL);
          return;
        }

        if (!hitsTarget) return;

        const cls = classesOf(el);
        for (const [name, kind] of KIND_CLASS) {
          if (cls.includes(name) && RANK[kind] > RANK[best]) best = kind;
        }
      },
    });

  // transform() の戻りを読み切らないとハンドラが走らない。
  await rewriter.transform(new Response(html)).arrayBuffer();

  return {
    linksTo,
    kind: best,
    // p-name を持たない h-card はカード内のテキスト全体を名前とみなす。
    authorName: collapse(nameParts) ?? collapse(cardParts),
    authorURL,
    authorPhoto,
    title: pickSourceTitle(
      collapse(entryNameParts),
      collapse(titleParts),
      baseURL,
    ),
    image,
  };
}
