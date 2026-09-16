import { describe, expect, it } from "vitest";
import { applyUpdate, parseUpdateAction } from "./mf2update";

const URL_ = "https://w.jgs.me/pages/foo";

describe("parseUpdateAction", () => {
  it("replace / add / delete を読む", () => {
    const a = parseUpdateAction({
      action: "update",
      url: URL_,
      replace: { content: ["new"] },
      add: { category: ["x"] },
      delete: ["photo"],
    });
    expect(a.url).toBe(URL_);
    expect(a.replace).toEqual({ content: ["new"] });
    expect(a.add).toEqual({ category: ["x"] });
    expect(a.deleteProps).toEqual(["photo"]);
    expect(a.deleteValues).toEqual({});
  });

  it("delete はオブジェクト形式も取る", () => {
    const a = parseUpdateAction({
      url: URL_,
      delete: { category: ["x"] },
    });
    expect(a.deleteProps).toEqual([]);
    expect(a.deleteValues).toEqual({ category: ["x"] });
  });

  it("url が無ければ弾く", () => {
    expect(() => parseUpdateAction({ replace: { content: ["x"] } })).toThrow();
    expect(() => parseUpdateAction({ url: "", replace: {} })).toThrow();
    expect(() => parseUpdateAction(null)).toThrow();
  });

  // 何もしない update を通すと、本文を書き直して purge まで走る。
  it("操作が 1 つも無ければ弾く", () => {
    expect(() => parseUpdateAction({ url: URL_ })).toThrow();
    expect(() => parseUpdateAction({ url: URL_, add: {} })).toThrow();
  });

  it("値が配列でなければ弾く", () => {
    expect(() =>
      parseUpdateAction({ url: URL_, replace: { content: "new" } }),
    ).toThrow();
  });

  it("replace / add がオブジェクトでなければ弾く", () => {
    expect(() => parseUpdateAction({ url: URL_, replace: ["x"] })).toThrow();
  });

  // mp- はクライアント→サーバの命令用に予約されている接頭辞。
  // https://www.w3.org/TR/micropub/#h-scope
  it("mp-silent が無ければ silent は false", () => {
    const a = parseUpdateAction({ url: URL_, replace: { content: ["new"] } });
    expect(a.silent).toBe(false);
  });

  it("mp-silent: true で silent になる", () => {
    const a = parseUpdateAction({
      url: URL_,
      replace: { content: ["new"] },
      "mp-silent": true,
    });
    expect(a.silent).toBe(true);
  });

  // Micropub の JSON 形式は値を配列で包む。命令も同じ形で来うる。
  it("mp-silent は配列で包まれていても読む", () => {
    const a = parseUpdateAction({
      url: URL_,
      replace: { content: ["new"] },
      "mp-silent": [true],
    });
    expect(a.silent).toBe(true);
  });

  it('mp-silent は文字列の "true" も取る', () => {
    for (const v of ["true", ["true"]]) {
      const a = parseUpdateAction({
        url: URL_,
        replace: { content: ["new"] },
        "mp-silent": v,
      });
      expect(a.silent).toBe(true);
    }
  });

  it("mp-silent: false は配送する", () => {
    for (const v of [false, [false], "false", ["false"]]) {
      const a = parseUpdateAction({
        url: URL_,
        replace: { content: ["new"] },
        "mp-silent": v,
      });
      expect(a.silent).toBe(false);
    }
  });

  // 読めない値を黙って false にすると、止めたつもりの update が
  // フォロワー全員に飛ぶ。倒れる側を「何もしない」に寄せる。
  it("mp-silent が真偽値として読めなければ弾く", () => {
    expect(() =>
      parseUpdateAction({
        url: URL_,
        replace: { content: ["new"] },
        "mp-silent": "yes",
      }),
    ).toThrow();
  });
});

describe("applyUpdate", () => {
  const props = {
    name: ["古い題"],
    content: [{ html: "<p>古い本文</p>" }],
    category: ["a", "b"],
  };

  it("replace は値を丸ごと差し替える", () => {
    const next = applyUpdate(props, {
      url: URL_,
      silent: false,
      replace: { name: ["新しい題"] },
      add: {},
      deleteProps: [],
      deleteValues: {},
    });
    expect(next.name).toEqual(["新しい題"]);
    expect(next.category).toEqual(["a", "b"]);
  });

  it("元の properties を書き換えない", () => {
    applyUpdate(props, {
      url: URL_,
      silent: false,
      replace: { name: ["新しい題"] },
      add: {},
      deleteProps: [],
      deleteValues: {},
    });
    expect(props.name).toEqual(["古い題"]);
  });

  it("add は既存の値の後ろに足す", () => {
    const next = applyUpdate(props, {
      url: URL_,
      silent: false,
      replace: {},
      add: { category: ["c"] },
      deleteProps: [],
      deleteValues: {},
    });
    expect(next.category).toEqual(["a", "b", "c"]);
  });

  it("add は存在しないプロパティなら作る", () => {
    const next = applyUpdate(props, {
      url: URL_,
      silent: false,
      replace: {},
      add: { photo: ["https://r2.jgs.me/x.png"] },
      deleteProps: [],
      deleteValues: {},
    });
    expect(next.photo).toEqual(["https://r2.jgs.me/x.png"]);
  });

  it("delete (プロパティ名) は丸ごと消す", () => {
    const next = applyUpdate(props, {
      url: URL_,
      silent: false,
      replace: {},
      add: {},
      deleteProps: ["category"],
      deleteValues: {},
    });
    expect(next).not.toHaveProperty("category");
  });

  it("delete (値指定) は該当する値だけ消す", () => {
    const next = applyUpdate(props, {
      url: URL_,
      silent: false,
      replace: {},
      add: {},
      deleteProps: [],
      deleteValues: { category: ["a"] },
    });
    expect(next.category).toEqual(["b"]);
  });

  // content は { html } のオブジェクト。参照比較では消えない。
  it("delete (値指定) はオブジェクトの値も消せる", () => {
    const next = applyUpdate(props, {
      url: URL_,
      silent: false,
      replace: {},
      add: {},
      deleteProps: [],
      deleteValues: { content: [{ html: "<p>古い本文</p>" }] },
    });
    expect(next).not.toHaveProperty("content");
  });

  it("値指定の delete で全部消えたらプロパティごと落とす", () => {
    const next = applyUpdate(props, {
      url: URL_,
      silent: false,
      replace: {},
      add: {},
      deleteProps: [],
      deleteValues: { category: ["a", "b"] },
    });
    expect(next).not.toHaveProperty("category");
  });

  it("空配列の replace はプロパティを落とす", () => {
    const next = applyUpdate(props, {
      url: URL_,
      silent: false,
      replace: { category: [] },
      add: {},
      deleteProps: [],
      deleteValues: {},
    });
    expect(next).not.toHaveProperty("category");
  });

  // 同じプロパティに delete と add が来たら、消してから足す。
  it("delete → replace → add の順で適用する", () => {
    const next = applyUpdate(props, {
      url: URL_,
      silent: false,
      replace: {},
      add: { category: ["c"] },
      deleteProps: ["category"],
      deleteValues: {},
    });
    expect(next.category).toEqual(["c"]);
  });
});
