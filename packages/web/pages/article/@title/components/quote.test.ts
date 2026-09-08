import { describe, expect, it } from "vitest";
import type { Block, Node } from "@progfay/scrapbox-parser";
import {
  isTitleQuoted,
  quoteClassName,
  quoteText,
  quoteTier,
} from "./quote";

const plain = (text: string): Node => ({ type: "plain", raw: text, text });

const quote = (nodes: Node[]): Node => ({
  type: "quote",
  raw: `> ${nodes.map((n) => n.raw).join("")}`,
  nodes,
});

describe("quoteText", () => {
  it("plain を連結する", () => {
    expect(quoteText(quote([plain("あい"), plain("うえお")]))).toBe("あいうえお");
  });

  it("link は表示される文字だけ数える", () => {
    // href は画面に出ないので長さに含めない。content が空のときは href が出る。
    const withContent: Node = {
      type: "link",
      raw: "[https://example.com/very/long/path ラベル]",
      pathType: "absolute",
      href: "https://example.com/very/long/path",
      content: "ラベル",
    };
    const withoutContent: Node = {
      type: "link",
      raw: "[/pages/題]",
      pathType: "relative",
      href: "題",
      content: "",
    };
    expect(quoteText(quote([withContent]))).toBe("ラベル");
    expect(quoteText(quote([withoutContent]))).toBe("題");
  });

  it("入れ子の strong / decoration の中も辿る", () => {
    const strong: Node = {
      type: "strong",
      raw: "[[太い]]",
      nodes: [plain("太い")],
    };
    const deco: Node = {
      type: "decoration",
      raw: "[! 飾り]",
      rawDecos: "!",
      decos: ["!"],
      nodes: [plain("飾り")],
    };
    expect(quoteText(quote([strong, plain("と"), deco]))).toBe("太いと飾り");
  });

  it("text を持つ node (code / helpfeel) も数える", () => {
    const code: Node = { type: "code", raw: "`x = 1`", text: "x = 1" };
    expect(quoteText(quote([code]))).toBe("x = 1");
  });

  it("画像や数式は文字を持たないので 0 文字", () => {
    const image: Node = {
      type: "image",
      raw: "[https://example.com/a.png]",
      src: "https://example.com/a.png",
      link: "",
    };
    expect(quoteText(quote([image]))).toBe("");
  });

  it("前後の空白は落とす", () => {
    expect(quoteText(quote([plain("  あい  ")]))).toBe("あい");
  });
});

describe("quoteTier", () => {
  // 直近の clip 300 件を実測した分布 (min 13 / p25 28 / median 55 / p75 110 / max 288)
  // に合わせて 30 と 100 で切る。short 約 1/4・medium 約 1/2・long 約 1/4 に割れる。
  it("30 文字以下は short", () => {
    expect(quoteTier(quote([plain("あ".repeat(1))]))).toBe("short");
    expect(quoteTier(quote([plain("あ".repeat(30))]))).toBe("short");
  });

  it("31〜100 文字は medium", () => {
    expect(quoteTier(quote([plain("あ".repeat(31))]))).toBe("medium");
    expect(quoteTier(quote([plain("あ".repeat(100))]))).toBe("medium");
  });

  it("101 文字以上は long", () => {
    expect(quoteTier(quote([plain("あ".repeat(101))]))).toBe("long");
    expect(quoteTier(quote([plain("あ".repeat(288))]))).toBe("long");
  });

  it("空の引用は short に倒す", () => {
    expect(quoteTier(quote([]))).toBe("short");
  });

  it("サロゲートペアを 1 文字として数える", () => {
    // "𠮷" は UTF-16 で 2 単位。String.length で数えると 30 文字ちょうどの
    // 引用が medium に落ちる。
    expect(quoteTier(quote([plain("𠮷".repeat(30))]))).toBe("short");
  });
});

describe("quoteClassName", () => {
  const short = quote([plain("あ".repeat(10))]);
  const medium = quote([plain("あ".repeat(50))]);
  const long = quote([plain("あ".repeat(200))]);

  // clip は引用が本体なので大きく出す。普通の記事の引用は地の文の一部なので、
  // 大きくすると本文の流れが切れる。切り替えは呼び出し側から渡る isClip 1 つ。
  it("clip でなければ長さに関係なく同じ見た目", () => {
    const plainLook = quoteClassName(short, { isClip: false, indent: 0 });
    expect(quoteClassName(medium, { isClip: false, indent: 0 })).toBe(plainLook);
    expect(quoteClassName(long, { isClip: false, indent: 0 })).toBe(plainLook);
  });

  it("clip でなければ大きくもはみ出しもしない", () => {
    const c = quoteClassName(short, { isClip: false, indent: 0 });
    expect(c).not.toMatch(/text-(xl|5xl)/);
    expect(c).not.toContain("quote-bleed");
  });

  it("clip なら長さで文字の大きさが変わる", () => {
    expect(quoteClassName(short, { isClip: true, indent: 0 })).toContain(
      "text-5xl",
    );
    expect(quoteClassName(medium, { isClip: true, indent: 0 })).toContain(
      "text-xl",
    );
    expect(quoteClassName(long, { isClip: true, indent: 0 })).toContain(
      "text-lg",
    );
  });

  it("clip の short / medium だけはみ出す", () => {
    expect(quoteClassName(short, { isClip: true, indent: 0 })).toContain(
      "quote-bleed",
    );
    expect(quoteClassName(medium, { isClip: true, indent: 0 })).toContain(
      "quote-bleed",
    );
    // long は幅を広げると 1 行が長くなりすぎる。
    expect(quoteClassName(long, { isClip: true, indent: 0 })).not.toContain(
      "quote-bleed",
    );
  });

  it("インデントされた行でははみ出さない", () => {
    // はみ出しは画面中央を基準に置くので、インデントぶんの位置を失う。
    expect(quoteClassName(short, { isClip: true, indent: 1 })).not.toContain(
      "quote-bleed",
    );
    // 大きさは残る。止めたいのは横位置だけ。
    expect(quoteClassName(short, { isClip: true, indent: 1 })).toContain(
      "text-5xl",
    );
  });

  it("clip でなければ上下の余白も足さない", () => {
    // 行の間隔は e-content の space-y-1 が作っている。ここで my を足すと、
    // clip でないページの引用まわりの間隔が変わってしまう。
    expect(quoteClassName(short, { isClip: false, indent: 0 })).not.toMatch(
      /\bmy-/,
    );
  });

  it("clip の引用は上下に余白を取る", () => {
    expect(quoteClassName(short, { isClip: true, indent: 0 })).toContain("my-4");
  });

  it("罫と背景はどちらでも付く", () => {
    for (const isClip of [true, false]) {
      const c = quoteClassName(medium, { isClip, indent: 0 });
      expect(c).toContain("border-l-4");
      expect(c).toContain("border-border-subtle");
    }
  });
});

const line = (nodes: Node[], indent = 0): Block => ({
  type: "line",
  indent,
  nodes,
});

describe("isTitleQuoted", () => {
  // clip は引用をそのまま題にすることが多い。そのとき題と本文の引用が同じ文を
  // 二度出すので、題を本文の下に回して小さくする。その判定。
  it("引用が題と完全に同じなら true", () => {
    const t = "出社という概念ぶち壊したい";
    expect(isTitleQuoted([line([quote([plain(t)])])], t)).toBe(true);
  });

  it("題が引用を切り詰めた形でも true", () => {
    // 題が長すぎて途中で切れているページが実在する。見た目は完全に二重。
    const body = "本作のライターであるトム・キング自身、ＣＩＡとしてイラクに駐在した経験を持っています。DCコミックスのVERTIGOレーベルから発表された";
    const title = "本作のライターであるトム・キング自身、ＣＩＡとしてイラクに駐在した経験を持っています。";
    expect(isTitleQuoted([line([quote([plain(body)])])], title)).toBe(true);
  });

  it("題が引用の要約や別の文なら false", () => {
    // 「承認欲求の行き着く先」= 題は要約、引用は別の文。二重ではない。
    const body = "読まずに、自分の言いたいことを書くだけの人の事";
    expect(isTitleQuoted([line([quote([plain(body)])])], "承認欲求の行き着く先")).toBe(
      false,
    );
  });

  it("引用が複数あってもどれか 1 つが題なら true", () => {
    const t = "「引退」とは、時間とお金に縛られない自由な生活を送ること";
    const blocks = [
      line([quote([plain("書くという行為は、心を耕すために必要不可欠なんですよ。")])]),
      line([quote([plain(t)])]),
    ];
    expect(isTitleQuoted(blocks, t)).toBe(true);
  });

  it("引用が複数でもどれも題でなければ false", () => {
    // 「Maison book girl … 特設サイト」= 題はサイト名、引用は記事からの抜粋。
    const blocks = [
      line([quote([plain("井上　-鍛えられてるからね（笑）。")])]),
      line([quote([plain("矢川　-皆さん物分かりがよくて、本当によかったです。")])]),
    ];
    expect(isTitleQuoted(blocks, "Maison book girl new single “SOUP” 特設サイト")).toBe(
      false,
    );
  });

  it("引用が無ければ false", () => {
    expect(isTitleQuoted([line([plain("題と同じ文")])], "題と同じ文")).toBe(false);
    expect(isTitleQuoted([], "題")).toBe(false);
  });

  it("空白の違いは無視する", () => {
    // 引用側だけ全角空白や改行が入っていることがある。空白で落としたくない。
    const blocks = [line([quote([plain("井上　-鍛えられてるからね（笑）。")])])];
    expect(isTitleQuoted(blocks, "井上 -鍛えられてるからね（笑）。")).toBe(true);
  });

  it("題が空なら false", () => {
    // startsWith("") は常に true。ガードが無いと引用のある clip が全部該当する。
    const blocks = [line([quote([plain("なんらかの引用")])])];
    expect(isTitleQuoted(blocks, "")).toBe(false);
    expect(isTitleQuoted(blocks, "   ")).toBe(false);
  });

  it("インデントされた行の引用も見る", () => {
    const t = "インデントの下にある引用";
    expect(isTitleQuoted([line([quote([plain(t)])], 2)], t)).toBe(true);
  });

  it("table のセルの中は見ない", () => {
    // 引用は行頭の > で作られるので、セルの中に quote node は現れない。
    // 走査対象を line に絞っていることを固定しておく。
    const blocks: Block[] = [
      { type: "table", indent: 0, fileName: "t", cells: [[[plain("題")]]] },
    ];
    expect(isTitleQuoted(blocks, "題")).toBe(false);
  });
});
