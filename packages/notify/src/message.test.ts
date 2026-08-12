import { describe, expect, it } from "vitest";
import {
  IS_COMPONENTS_V2,
  MAX_COMPONENTS,
  buildArticleComponents,
  buildMessages,
  escapeLinkText,
  resultLabel,
} from "./message";
import type { MessageComponent } from "./types";

const SITE = "jgs.me";

const pages = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, title: `ページ${i + 1}` }));

// Discord は入れ子のボタンも 1 個として数えるので、同じ数え方で検証する。
const countComponents = (components: MessageComponent[]): number =>
  components.reduce(
    (total, component) =>
      total + 1 + (component.type === 1 ? component.components.length : 0),
    0,
  );

describe("escapeLinkText", () => {
  it("角括弧をエスケープしてリンクが途中で切れないようにする", () => {
    expect(escapeLinkText("[草稿] 記事")).toBe("\\[草稿\\] 記事");
  });

  it("バックスラッシュ自体もエスケープする", () => {
    expect(escapeLinkText("a\\b")).toBe("a\\\\b");
  });

  it("普通のタイトルはそのまま返す", () => {
    expect(escapeLinkText("ふつうの記事")).toBe("ふつうの記事");
  });
});

describe("buildArticleComponents", () => {
  it("タイトルのリンクと 3 ボタンの行を 2 段で返す", () => {
    expect(buildArticleComponents({ id: 12, title: "テスト" }, SITE)).toEqual([
      { type: 10, content: "[テスト](https://jgs.me/p/12)" },
      {
        type: 1,
        components: [
          { type: 2, style: 1, label: "📝 記事", custom_id: "a:register:12" },
          { type: 2, style: 2, label: "📎 クリップ", custom_id: "a:clip:12" },
          { type: 2, style: 4, label: "🚫 除外", custom_id: "a:exclude:12" },
        ],
      },
    ]);
  });

  it("タイトルの角括弧をエスケープしてリンクに埋める", () => {
    const [text] = buildArticleComponents({ id: 1, title: "[草稿]" }, SITE);
    expect(text).toEqual({
      type: 10,
      content: "[\\[草稿\\]](https://jgs.me/p/1)",
    });
  });
});

describe("buildMessages", () => {
  it("0 件なら空配列を返す", () => {
    expect(buildMessages([], SITE)).toEqual([]);
  });

  it("Components V2 のフラグを立てる", () => {
    expect(buildMessages(pages(1), SITE)[0].flags).toBe(IS_COMPONENTS_V2);
  });

  // 1 メッセージに複数記事を入れると、1 つ押した間その中の全ボタンが
  // 無効化されて他の記事を触れなくなる。だから記事ごとに分ける。
  it("記事 1 件につき 1 メッセージにする", () => {
    expect(buildMessages(pages(1), SITE)).toHaveLength(1);
    expect(buildMessages(pages(7), SITE)).toHaveLength(7);
    expect(buildMessages(pages(20), SITE)).toHaveLength(20);
  });

  it("1 メッセージはタイトルとボタン行だけで構成する", () => {
    const [message] = buildMessages(pages(1), SITE);
    expect(message.components.map((component) => component.type)).toEqual([
      10, // タイトル
      1, // ボタン行
    ]);
  });

  it("各メッセージが対応する記事のボタンを持つ", () => {
    const messages = buildMessages(pages(3), SITE);
    const registerIds = messages.map((message) => {
      const row = message.components[1];
      return row.type === 1 ? row.components[0].custom_id : null;
    });

    expect(registerIds).toEqual([
      "a:register:1",
      "a:register:2",
      "a:register:3",
    ]);
  });

  it("どのメッセージも Discord のコンポーネント上限に収まる", () => {
    for (const message of buildMessages(pages(20), SITE)) {
      expect(countComponents(message.components)).toBeLessThanOrEqual(
        MAX_COMPONENTS,
      );
    }
  });
});

describe("resultLabel", () => {
  it("成功したら操作名を過去形で返す", () => {
    expect(resultLabel("clip", { status: "ok", title: "テスト" })).toBe(
      "✅ クリップした",
    );
    expect(resultLabel("register", { status: "ok", title: "テスト" })).toBe(
      "✅ 記事に登録した",
    );
    expect(resultLabel("exclude", { status: "ok", title: "テスト" })).toBe(
      "✅ 除外した",
    );
  });

  it("処理済みなら既に済みである旨を返す", () => {
    expect(resultLabel("clip", { status: "already", title: "テスト" })).toBe(
      "⚠️ 既にクリップ済み",
    );
  });

  it("ページが無ければその旨を返す", () => {
    expect(resultLabel("register", { status: "notfound" })).toBe(
      "⚠️ ページが見つからない",
    );
  });
});
