import { describe, expect, it } from "vitest";
import { decide, parseCustomId, replaceRow } from "./interactions";
import type { ActionRow } from "./types";

const row = (pageId: number): ActionRow => ({
  type: 1,
  components: [
    {
      type: 2,
      style: 1,
      label: `📝 ページ${pageId}`,
      custom_id: `a:register:${pageId}`,
    },
    { type: 2, style: 5, label: "🔗", url: `https://jgs.me/p/${pageId}` },
    { type: 2, style: 2, label: "📎", custom_id: `a:clip:${pageId}` },
    { type: 2, style: 4, label: "🚫", custom_id: `a:exclude:${pageId}` },
  ],
});

describe("parseCustomId", () => {
  it("操作ボタンの custom_id を分解する", () => {
    expect(parseCustomId("a:register:12")).toEqual({
      action: "register",
      pageId: 12,
    });
    expect(parseCustomId("a:clip:3")).toEqual({ action: "clip", pageId: 3 });
    expect(parseCustomId("a:exclude:7")).toEqual({
      action: "exclude",
      pageId: 7,
    });
  });

  it("処理済みボタンは null を返す", () => {
    expect(parseCustomId("done:12")).toBeNull();
  });

  it("prefix が違えば null を返す", () => {
    expect(parseCustomId("b:register:12")).toBeNull();
  });

  it("知らない action なら null を返す", () => {
    expect(parseCustomId("a:destroy:12")).toBeNull();
  });

  it("pageId が数値でなければ null を返す", () => {
    expect(parseCustomId("a:register:abc")).toBeNull();
    expect(parseCustomId("a:register:")).toBeNull();
  });

  it("要素数が 3 でなければ null を返す", () => {
    expect(parseCustomId("a:register")).toBeNull();
    expect(parseCustomId("a:register:12:extra")).toBeNull();
  });
});

describe("decide", () => {
  it("type 1 は pong", () => {
    expect(decide({ type: 1 })).toEqual({ kind: "pong" });
  });

  it("type 3 かつ既知の custom_id は component", () => {
    expect(decide({ type: 3, data: { custom_id: "a:clip:5" } })).toEqual({
      kind: "component",
      action: "clip",
      pageId: 5,
    });
  });

  it("type 3 でも処理済みボタンは unknown", () => {
    expect(decide({ type: 3, data: { custom_id: "done:5" } })).toEqual({
      kind: "unknown",
    });
  });

  it("type 3 で custom_id が無ければ unknown", () => {
    expect(decide({ type: 3 })).toEqual({ kind: "unknown" });
  });

  it("slash command (type 2) は unknown", () => {
    expect(decide({ type: 2 })).toEqual({ kind: "unknown" });
  });
});

describe("replaceRow", () => {
  it("該当する行だけを disabled な 1 ボタンに置き換える", () => {
    const rows = [row(1), row(2), row(3)];
    const out = replaceRow(rows, 2, "✅ ページ2 — クリップした");

    expect(out).toHaveLength(3);
    expect(out[1]).toEqual({
      type: 1,
      components: [
        {
          type: 2,
          style: 2,
          label: "✅ ページ2 — クリップした",
          custom_id: "done:2",
          disabled: true,
        },
      ],
    });
  });

  it("該当しない行は元のまま残す", () => {
    const rows = [row(1), row(2), row(3)];
    const out = replaceRow(rows, 2, "済み");

    expect(out[0]).toEqual(rows[0]);
    expect(out[2]).toEqual(rows[2]);
  });

  it("該当する行が無ければ全部そのまま返す", () => {
    const rows = [row(1), row(2)];
    expect(replaceRow(rows, 99, "済み")).toEqual(rows);
  });

  it("既に置き換わった行は再度置き換えない", () => {
    const rows = replaceRow([row(1), row(2)], 1, "済み");
    expect(replaceRow(rows, 1, "別の文言")).toEqual(rows);
  });
});
