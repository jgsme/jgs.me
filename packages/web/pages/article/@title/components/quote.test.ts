import { describe, expect, it } from "vitest";
import type { Block, Node } from "@progfay/scrapbox-parser";
import { groupQuoteRuns, quoteClassName, quoteText, quoteTier } from "./quote";

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
  // 50 はモバイルで 48px のまま読める限度、100 はデスクトップで読める限度。
  // 実画面のキャプチャで決めた (390px で 50 字 6〜7 行、1440px で 100 字 5 行)。
  it("50 文字以下は short", () => {
    expect(quoteTier(quote([plain("あ".repeat(1))]))).toBe("short");
    expect(quoteTier(quote([plain("あ".repeat(50))]))).toBe("short");
  });

  it("51〜100 文字は medium", () => {
    expect(quoteTier(quote([plain("あ".repeat(51))]))).toBe("medium");
    expect(quoteTier(quote([plain("あ".repeat(100))]))).toBe("medium");
  });

  it("101〜400 文字は long", () => {
    expect(quoteTier(quote([plain("あ".repeat(101))]))).toBe("long");
    expect(quoteTier(quote([plain("あ".repeat(400))]))).toBe("long");
  });

  it("401 文字以上は xlong", () => {
    expect(quoteTier(quote([plain("あ".repeat(401))]))).toBe("xlong");
    expect(quoteTier(quote([plain("あ".repeat(1139))]))).toBe("xlong");
  });

  it("複数の引用を渡すと合計の長さで決める", () => {
    // 連続する引用行は 1 つの引用として出す。行ごとに測ると同じ引用の中で大きさが割れる。
    const lines = [
      quote([plain("あ".repeat(30))]),
      quote([plain("あ".repeat(30))]),
    ];
    expect(quoteTier(lines)).toBe("medium");
  });

  it("空の引用は short に倒す", () => {
    expect(quoteTier(quote([]))).toBe("short");
  });

  it("サロゲートペアを 1 文字として数える", () => {
    // "𠮷" は UTF-16 で 2 単位。String.length で数えると 50 文字ちょうどの
    // 引用が medium に落ちる。
    expect(quoteTier(quote([plain("𠮷".repeat(50))]))).toBe("short");
  });
});

describe("quoteClassName", () => {
  const short = quote([plain("あ".repeat(10))]);
  const medium = quote([plain("あ".repeat(80))]);
  const long = quote([plain("あ".repeat(200))]);
  const xlong = quote([plain("あ".repeat(500))]);

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
    expect(quoteClassName(xlong, { emphasize: true, indent: 0 })).toContain(
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
    // xlong は幅を広げると行数が多すぎて、中央寄せの塊として読めない。
    expect(quoteClassName(xlong, { emphasize: true, indent: 0 })).not.toMatch(
      /quote-bleed/,
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
      "[--quote-mark-inset:-0.25em]",
    );
    expect(quoteClassName(medium, { emphasize: true, indent: 0 })).toContain(
      "[--quote-mark-inset:-0.2em]",
    );
  });

  // 51〜100 字はデスクトップなら 48px でも 5 行ほどで収まるが、モバイルは 1 行
  // 7〜8 字なので 13 行を超える。md (本文幅 48rem) 以上だけ short の見た目に上げる。
  it("medium は md 以上で short の見た目になる", () => {
    const c = quoteClassName(medium, { emphasize: true, indent: 0 });
    expect(c).toContain("text-xl");
    expect(c).toContain("md:text-5xl");
    expect(c).toContain("md:leading-tight");
    expect(c).toContain("md:py-6");
    expect(c).toContain("md:[--quote-mark-inset:-0.25em]");
  });

  // clip の引用は大きく出るぶん、黒のままだと強すぎる。本文より一段引いた色にする。
  it("emphasize の引用は段階に関係なく fg-quote の色", () => {
    for (const node of [short, medium, long, xlong]) {
      expect(quoteClassName(node, { emphasize: true, indent: 0 })).toMatch(
        /(^| )text-fg-quote( |$)/,
      );
    }
  });

  it("emphasize でないページの引用は色を変えない", () => {
    expect(
      quoteClassName(short, { emphasize: false, indent: 0 }),
    ).not.toContain("text-fg-quote");
  });

  // 大きく出す 2 段 (short / medium) だけ明朝にする。long 以上は地の文と同じ sans で
  // 読ませる (長い引用ほど本文として読むので、書体を変えると読みのリズムが切れる)。
  it("short / medium は明朝", () => {
    for (const node of [short, medium]) {
      expect(quoteClassName(node, { emphasize: true, indent: 0 })).toMatch(
        /(^| )font-quote( |$)/,
      );
    }
  });

  it("long / xlong は明朝にしない", () => {
    for (const node of [long, xlong]) {
      expect(
        quoteClassName(node, { emphasize: true, indent: 0 }),
      ).not.toContain("font-quote");
    }
  });

  it("emphasize でないページの引用は書体を変えない", () => {
    expect(
      quoteClassName(short, { emphasize: false, indent: 0 }),
    ).not.toContain("font-quote");
  });

  it("short は太字", () => {
    expect(quoteClassName(short, { emphasize: true, indent: 0 })).toMatch(
      /(^| )font-bold( |$)/,
    );
  });

  it("medium は md 以上でだけ太字", () => {
    const c = quoteClassName(medium, { emphasize: true, indent: 0 });
    expect(c).toContain("md:font-bold");
    expect(c).not.toMatch(/(^| )font-bold( |$)/);
  });

  // 101〜400 字はデスクトップなら 20px の中央寄せで 8 行ほどに収まるが、モバイルは
  // 1 行 17 字前後なので 20 行を超える。モバイルは本文幅の罫付きのまま、md 以上だけ上げる。
  it("long はモバイルでは本文幅、md 以上で medium の見た目", () => {
    const c = quoteClassName(long, { emphasize: true, indent: 0 });
    expect(c).toContain("border-l-4");
    expect(c).toContain("text-lg");
    expect(c).toContain("md:border-l-0");
    expect(c).toContain("md:bg-transparent");
    expect(c).toContain("md:text-xl");
    expect(c).toContain("md:italic");
    expect(c).toContain("md:quote-marks");
    expect(c).toContain("md:text-center");
    expect(c).toContain("md:quote-bleed");
    expect(c).not.toMatch(/(^| )quote-bleed( |$)/);
  });

  it("long もインデントされた行でははみ出さない", () => {
    const c = quoteClassName(long, { emphasize: true, indent: 1 });
    expect(c).not.toContain("quote-bleed");
    expect(c).toContain("md:text-xl");
  });

  it("はみ出す引用は長い英数字の塊でも折り返す", () => {
    // コミットハッシュや URL は語の途中で折れず、48px だとはみ出し幅を突き抜ける。
    for (const node of [short, medium, long]) {
      expect(quoteClassName(node, { emphasize: true, indent: 0 })).toContain(
        "wrap-anywhere",
      );
    }
  });

  it("複数の引用を渡すと合計の長さで見た目を決める", () => {
    const lines = [
      quote([plain("あ".repeat(30))]),
      quote([plain("あ".repeat(30))]),
    ];
    expect(quoteClassName(lines, { emphasize: true, indent: 0 })).toBe(
      quoteClassName(quote([plain("あ".repeat(60))]), {
        emphasize: true,
        indent: 0,
      }),
    );
  });

  it("short は画面幅で見た目を変えない", () => {
    const c = quoteClassName(short, { emphasize: true, indent: 0 });
    expect(c).not.toContain("md:");
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

  it("xlong は罫と背景のまま", () => {
    // 本文幅に留まる引用は地の文に混ざるので、囲いが無いと引用だと分からない。
    const c = quoteClassName(xlong, { emphasize: true, indent: 0 });
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
const q = (text: string) => line([quote([plain(text)])]);

describe("groupQuoteRuns", () => {
  it("連続する引用行を 1 つの塊にまとめる", () => {
    const blocks = [
      line([plain("前")]),
      q("一"),
      q("二"),
      q("三"),
      line([plain("後")]),
    ];
    const items = groupQuoteRuns(blocks);
    expect(items.map((i) => i.type)).toEqual(["block", "quoteRun", "block"]);
    const run = items[1];
    expect(run.type === "quoteRun" && run.lines).toEqual([
      q("一"),
      q("二"),
      q("三"),
    ]);
  });

  it("1 行だけの引用も塊として扱う", () => {
    const items = groupQuoteRuns([q("一")]);
    expect(items).toEqual([{ type: "quoteRun", indent: 0, lines: [q("一")] }]);
  });

  it("引用でない行を挟むと別の塊になる", () => {
    const items = groupQuoteRuns([q("一"), line([plain("地の文")]), q("二")]);
    expect(items.map((i) => i.type)).toEqual(["quoteRun", "block", "quoteRun"]);
  });

  it("空行を挟むと別の塊になる", () => {
    const items = groupQuoteRuns([q("一"), line([]), q("二")]);
    expect(items.map((i) => i.type)).toEqual(["quoteRun", "block", "quoteRun"]);
  });

  it("インデントが変わると別の塊になる", () => {
    // はみ出しの有無はインデントで変わるので、同じ塊にすると位置が決められない。
    const items = groupQuoteRuns([q("一"), line([quote([plain("二")])], 1)]);
    expect(items).toEqual([
      { type: "quoteRun", indent: 0, lines: [q("一")] },
      { type: "quoteRun", indent: 1, lines: [line([quote([plain("二")])], 1)] },
    ]);
  });

  it("line 以外の block はそのまま通す", () => {
    const code: Block = {
      type: "codeBlock",
      indent: 0,
      fileName: "a",
      content: "x",
    };
    expect(groupQuoteRuns([code])).toEqual([{ type: "block", block: code }]);
  });
});
