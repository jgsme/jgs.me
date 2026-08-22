import { sameURL } from "./sameurl";

export type Extracted = {
  // source に target へのリンクが実在するか。Webmention 仕様が要求する検証。
  linksTo: boolean;
  kind: "reply" | "like" | "repost" | "bookmark" | "mention";
  authorName: string | null;
  authorURL: string | null;
  authorPhoto: string | null;
};

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

function collapse(parts: string[]): string | null {
  const s = parts.join("").replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
}

// 完全な mf2 パーサは書かない。Webmention の受信に必要な3点だけを取る。
//   1. source に target へのリンクが実在するか
//   2. どの u-* class が target を指すか (種別判定)
//   3. p-author の name / url / photo (表示用)
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
  };
}
