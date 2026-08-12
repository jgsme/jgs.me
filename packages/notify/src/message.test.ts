import { describe, expect, it } from "vitest";
import {
  ARTICLES_PER_MESSAGE,
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

  it("6 件までは 1 メッセージに収める", () => {
    expect(buildMessages(pages(ARTICLES_PER_MESSAGE), SITE)).toHaveLength(1);
  });

  it("7 件なら 6 件と 1 件の 2 メッセージに割れる", () => {
    const messages = buildMessages(pages(7), SITE);
    expect(messages).toHaveLength(2);
    expect(
      messages[0].components.filter((component) => component.type === 1),
    ).toHaveLength(6);
    expect(
      messages[1].components.filter((component) => component.type === 1),
    ).toHaveLength(1);
  });

  it("20 件なら 4 メッセージに割れる", () => {
    expect(buildMessages(pages(20), SITE)).toHaveLength(4);
  });

  it("どのメッセージも Discord のコンポーネント上限に収まる", () => {
    for (const message of buildMessages(pages(20), SITE)) {
      expect(countComponents(message.components)).toBeLessThanOrEqual(
        MAX_COMPONENTS,
      );
    }
  });

  it("1 通目に総件数、2 通目以降はつづき表記を入れる", () => {
    const messages = buildMessages(pages(7), SITE);
    expect(messages[0].components[0]).toEqual({
      type: 10,
      content: "**未登録の記事が 7 件あるよ**",
    });
    expect(messages[1].components[0]).toEqual({
      type: 10,
      content: "**(つづき)**",
    });
  });

  it("記事の間にだけ区切り線を入れる", () => {
    const [message] = buildMessages(pages(2), SITE);
    expect(message.components.map((component) => component.type)).toEqual([
      10, // ヘッダ
      10, // 1 件目のタイトル
      1, // 1 件目のボタン
      14, // 区切り線
      10, // 2 件目のタイトル
      1, // 2 件目のボタン
    ]);
  });

  it("区切り線は線を表示する", () => {
    const [message] = buildMessages(pages(2), SITE);
    expect(message.components[3]).toEqual({
      type: 14,
      divider: true,
      spacing: 1,
    });
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
