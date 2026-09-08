import { describe, expect, it } from "vitest";
import type { Block, Node } from "@progfay/scrapbox-parser";
import {
  countQuotes,
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
    expect(quoteText(quote([plain("あい"), plain("うえお")]))).toBe(
      "あいうえお",
    );
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
  // 大きくすると本文の流れが切れる。切り替えは呼び出し側から渡る emphasize 1 つ。
  it("emphasize でなければ長さに関係なく同じ見た目", () => {
    const plainLook = quoteClassName(short, { emphasize: false, indent: 0 });
    expect(quoteClassName(medium, { emphasize: false, indent: 0 })).toBe(
      plainLook,
    );
    expect(quoteClassName(long, { emphasize: false, indent: 0 })).toBe(
      plainLook,
    );
  });

  it("emphasize でなければ大きくもはみ出しもしない", () => {
    const c = quoteClassName(short, { emphasize: false, indent: 0 });
    expect(c).not.toMatch(/text-(xl|5xl)/);
    expect(c).not.toContain("quote-bleed");
  });

  it("emphasize なら長さで文字の大きさが変わる", () => {
    expect(quoteClassName(short, { emphasize: true, indent: 0 })).toContain(
      "text-5xl",
    );
    expect(quoteClassName(medium, { emphasize: true, indent: 0 })).toContain(
      "text-xl",
    );
    expect(quoteClassName(long, { emphasize: true, indent: 0 })).toContain(
      "text-lg",
    );
  });

  it("short / medium だけはみ出す", () => {
    expect(quoteClassName(short, { emphasize: true, indent: 0 })).toContain(
      "quote-bleed",
    );
    expect(quoteClassName(medium, { emphasize: true, indent: 0 })).toContain(
      "quote-bleed",
    );
    // long は幅を広げると 1 行が長くなりすぎる。
    expect(quoteClassName(long, { emphasize: true, indent: 0 })).not.toContain(
      "quote-bleed",
    );
  });

  it("インデントされた行でははみ出さない", () => {
    // はみ出しは画面中央を基準に置くので、インデントぶんの位置を失う。
    expect(quoteClassName(short, { emphasize: true, indent: 1 })).not.toContain(
      "quote-bleed",
    );
    // 大きさは残る。止めたいのは横位置だけ。
    expect(quoteClassName(short, { emphasize: true, indent: 1 })).toContain(
      "text-5xl",
    );
  });

  it("emphasize でなければ上下の余白も足さない", () => {
    // 行の間隔は e-content の space-y-1 が作っている。ここで my を足すと、
    // emphasize でないページの引用まわりの間隔が変わってしまう。
    expect(quoteClassName(short, { emphasize: false, indent: 0 })).not.toMatch(
      /\bmy-/,
    );
  });

  it("emphasize の引用は上下に余白を取る", () => {
    expect(quoteClassName(short, { emphasize: true, indent: 0 })).toContain(
      "my-4",
    );
  });

  // はみ出す 2 段 (short / medium) は「大きく出す引用」として見た目を変える。
  // 罫と背景で囲うのをやめ、italic とダブルクォートで引用だと示す。
  it("はみ出す 2 段は罫も背景も付けない", () => {
    for (const node of [short, medium]) {
      const c = quoteClassName(node, { emphasize: true, indent: 0 });
      expect(c).not.toContain("border-l-4");
      expect(c).not.toContain("bg-black/1");
    }
  });

  it("開きの詰めは tier ごとに変える", () => {
    // 光学的な詰めは字のサイズに線形比例しない。em の比率を揃えると、
    // 48px の short でちょうどいい詰めが 20px の medium では食い込みすぎる。
    expect(quoteClassName(short, { emphasize: true, indent: 0 })).toContain(
      "[--quote-mark-inset:-0.4em]",
    );
    expect(quoteClassName(medium, { emphasize: true, indent: 0 })).toContain(
      "[--quote-mark-inset:-0.2em]",
    );
  });

  it("はみ出す 2 段は italic とダブルクォートを付ける", () => {
    for (const node of [short, medium]) {
      const c = quoteClassName(node, { emphasize: true, indent: 0 });
      expect(c).toContain("italic");
      expect(c).toContain("quote-marks");
    }
  });

  it("はみ出す 2 段は中央寄せ", () => {
    // 1 行に収まる短い引用が左端に寄っていると、右に空きができて据わりが悪い。
    for (const node of [short, medium]) {
      expect(quoteClassName(node, { emphasize: true, indent: 0 })).toContain(
        "text-center",
      );
    }
  });

  it("long は罫と背景のまま", () => {
    // 本文幅に留まる引用は地の文に混ざるので、囲いが無いと引用だと分からない。
    const c = quoteClassName(long, { emphasize: true, indent: 0 });
    expect(c).toContain("border-l-4");
    expect(c).toContain("bg-black/1");
    expect(c).not.toContain("italic");
    expect(c).not.toContain("quote-marks");
    // 中央寄せは 1 行前後の引用のためのもの。本文幅で何行も続く引用を中央に
    // 寄せると行頭が揃わず読めない。
    expect(c).not.toContain("text-center");
  });

  it("emphasize でないページも罫と背景のまま", () => {
    const c = quoteClassName(short, { emphasize: false, indent: 0 });
    expect(c).toContain("border-l-4");
    expect(c).toContain("bg-black/1");
    expect(c).not.toContain("italic");
    expect(c).not.toContain("quote-marks");
  });

  it("はみ出さないインデント下でも見た目は大きい側のまま", () => {
    // 止めたいのは横位置だけ。囲いの有無まで戻すと、同じ長さの引用が
    // インデントの有無で別物に見える。
    const c = quoteClassName(short, { emphasize: true, indent: 1 });
    expect(c).toContain("italic");
    expect(c).toContain("quote-marks");
    expect(c).not.toContain("border-l-4");
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
    const body =
      "本作のライターであるトム・キング自身、ＣＩＡとしてイラクに駐在した経験を持っています。DCコミックスのVERTIGOレーベルから発表された";
    const title =
      "本作のライターであるトム・キング自身、ＣＩＡとしてイラクに駐在した経験を持っています。";
    expect(isTitleQuoted([line([quote([plain(body)])])], title)).toBe(true);
  });

  it("題が引用の要約や別の文なら false", () => {
    // 「承認欲求の行き着く先」= 題は要約、引用は別の文。二重ではない。
    const body = "読まずに、自分の言いたいことを書くだけの人の事";
    expect(
      isTitleQuoted([line([quote([plain(body)])])], "承認欲求の行き着く先"),
    ).toBe(false);
  });

  it("引用が複数あってもどれか 1 つが題なら true", () => {
    const t = "「引退」とは、時間とお金に縛られない自由な生活を送ること";
    const blocks = [
      line([
        quote([
          plain("書くという行為は、心を耕すために必要不可欠なんですよ。"),
        ]),
      ]),
      line([quote([plain(t)])]),
    ];
    expect(isTitleQuoted(blocks, t)).toBe(true);
  });

  it("引用が複数でもどれも題でなければ false", () => {
    // 「Maison book girl … 特設サイト」= 題はサイト名、引用は記事からの抜粋。
    const blocks = [
      line([quote([plain("井上　-鍛えられてるからね（笑）。")])]),
      line([
        quote([plain("矢川　-皆さん物分かりがよくて、本当によかったです。")]),
      ]),
    ];
    expect(
      isTitleQuoted(blocks, "Maison book girl new single “SOUP” 特設サイト"),
    ).toBe(false);
  });

  it("引用が無ければ false", () => {
    expect(isTitleQuoted([line([plain("題と同じ文")])], "題と同じ文")).toBe(
      false,
    );
    expect(isTitleQuoted([], "題")).toBe(false);
  });

  it("空白の違いは無視する", () => {
    // 引用側だけ全角空白や改行が入っていることがある。空白で落としたくない。
    const blocks = [
      line([quote([plain("井上　-鍛えられてるからね（笑）。")])]),
    ];
    expect(isTitleQuoted(blocks, "井上 -鍛えられてるからね（笑）。")).toBe(
      true,
    );
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

describe("countQuotes", () => {
  // 引用が複数あるページでは大きくしない。記事から複数箇所を引いている記事は、
  // どれか 1 つを殴る記事ではない。その判定に使う。
  it("行の中の quote を数える", () => {
    expect(countQuotes([])).toBe(0);
    expect(countQuotes([line([plain("引用ではない")])])).toBe(0);
    expect(countQuotes([line([quote([plain("あ")])])])).toBe(1);
    expect(
      countQuotes([
        line([quote([plain("あ")])]),
        line([plain("地の文")]),
        line([quote([plain("い")])]),
      ]),
    ).toBe(2);
  });

  it("インデントされた行の引用も数える", () => {
    expect(countQuotes([line([quote([plain("あ")])], 2)])).toBe(1);
  });

  it("1 行に 2 つあれば 2 と数える", () => {
    expect(
      countQuotes([line([quote([plain("あ")]), quote([plain("い")])])]),
    ).toBe(2);
  });

  it("table のセルの中は数えない", () => {
    // 引用は行頭の > で作られるので、セルの中に quote node は現れない。
    // isTitleQuoted と走査対象を揃えておく。
    const blocks: Block[] = [
      { type: "table", indent: 0, fileName: "t", cells: [[[plain("題")]]] },
    ];
    expect(countQuotes(blocks)).toBe(0);
  });
});
