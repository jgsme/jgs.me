import { describe, expect, it } from "vitest";
import {
  ROWS_PER_MESSAGE,
  buildMessages,
  buildRow,
  resultLabel,
  truncateLabel,
} from "./message";

const SITE = "jgs.me";

const pages = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, title: `ページ${i + 1}` }));

describe("truncateLabel", () => {
  it("80 字ちょうどはそのまま返す", () => {
    const label = "あ".repeat(80);
    expect(truncateLabel(label)).toBe(label);
  });

  it("81 字は 80 字に切り詰めて末尾を … にする", () => {
    const out = truncateLabel("あ".repeat(81));
    expect(out).toHaveLength(80);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("buildRow", () => {
  it("1 記事から 4 ボタンの action row を作る", () => {
    expect(buildRow({ id: 12, title: "テスト" }, SITE)).toEqual({
      type: 1,
      components: [
        { type: 2, style: 1, label: "📝 テスト", custom_id: "a:register:12" },
        { type: 2, style: 5, label: "🔗", url: "https://jgs.me/p/12" },
        { type: 2, style: 2, label: "📎", custom_id: "a:clip:12" },
        { type: 2, style: 4, label: "🚫", custom_id: "a:exclude:12" },
      ],
    });
  });

  it("長いタイトルは記事ボタンのラベルを 80 字に切り詰める", () => {
    const row = buildRow({ id: 1, title: "あ".repeat(100) }, SITE);
    expect(row.components[0].label).toHaveLength(80);
  });
});

describe("buildMessages", () => {
  it("0 件なら空配列を返す", () => {
    expect(buildMessages([], SITE)).toEqual([]);
  });

  it("5 件なら 1 メッセージに 5 row 入る", () => {
    const messages = buildMessages(pages(5), SITE);
    expect(messages).toHaveLength(1);
    expect(messages[0].components).toHaveLength(5);
  });

  it("7 件なら 5 row と 2 row の 2 メッセージに割れる", () => {
    const messages = buildMessages(pages(7), SITE);
    expect(messages.map((m) => m.components.length)).toEqual([5, 2]);
  });

  it("20 件なら 4 メッセージに割れる", () => {
    expect(buildMessages(pages(20), SITE)).toHaveLength(4);
  });

  it("1 通目に総件数、2 通目以降はつづき表記を入れる", () => {
    const messages = buildMessages(pages(7), SITE);
    expect(messages[0].content).toBe("**未登録の記事が 7 件あるよ**");
    expect(messages[1].content).toBe("**(つづき)**");
  });

  it("ROWS_PER_MESSAGE は Discord の action row 上限と同じ 5", () => {
    expect(ROWS_PER_MESSAGE).toBe(5);
  });
});

describe("resultLabel", () => {
  it("成功したら操作名を過去形で返す", () => {
    expect(resultLabel("clip", { status: "ok", title: "テスト" })).toBe(
      "✅ テスト — クリップした",
    );
    expect(resultLabel("register", { status: "ok", title: "テスト" })).toBe(
      "✅ テスト — 記事に登録した",
    );
    expect(resultLabel("exclude", { status: "ok", title: "テスト" })).toBe(
      "✅ テスト — 除外した",
    );
  });

  it("処理済みなら既に済みである旨を返す", () => {
    expect(resultLabel("clip", { status: "already", title: "テスト" })).toBe(
      "⚠️ テスト — 既にクリップ済み",
    );
  });

  it("ページが無ければタイトル抜きの文言を返す", () => {
    expect(resultLabel("register", { status: "notfound" })).toBe(
      "⚠️ ページが見つからない",
    );
  });

  it("長いタイトルでも 80 字に収まる", () => {
    const label = resultLabel("clip", {
      status: "ok",
      title: "あ".repeat(100),
    });
    expect(label.length).toBeLessThanOrEqual(80);
  });
});
