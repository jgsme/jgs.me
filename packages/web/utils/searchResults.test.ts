import { describe, expect, it } from "vitest";
import {
  bodyKeyFromFilename,
  dedupeByBodyKey,
  snippetFromMd,
} from "./searchResults";

describe("bodyKeyFromFilename", () => {
  it("拡張子を落として bodyKey にする", () => {
    expect(bodyKeyFromFilename("sb-0189abcd.md")).toBe("sb-0189abcd");
    expect(bodyKeyFromFilename("5f8a1b2c.md")).toBe("5f8a1b2c");
  });

  // 原本バケットを指したままの instance を引くと .json / .sb が返る。
  // 題を引けないものを結果に混ぜない。
  it("md 以外は null", () => {
    expect(bodyKeyFromFilename("5f8a1b2c.json")).toBeNull();
    expect(bodyKeyFromFilename("sb-0189abcd.sb")).toBeNull();
    expect(bodyKeyFromFilename("")).toBeNull();
  });
});

describe("dedupeByBodyKey", () => {
  // 1 ページが複数 chunk に割れると同じページが並ぶ。max_num_results は
  // 「20 chunk」であって 20 ページではない。
  it("同じ bodyKey は最初の 1 件だけ残す", () => {
    const items = [
      { bodyKey: "a", score: 0.9 },
      { bodyKey: "b", score: 0.8 },
      { bodyKey: "a", score: 0.7 },
    ];

    expect(dedupeByBodyKey(items)).toEqual([
      { bodyKey: "a", score: 0.9 },
      { bodyKey: "b", score: 0.8 },
    ]);
  });

  it("順番は変えない", () => {
    const items = [
      { bodyKey: "b", score: 0.9 },
      { bodyKey: "a", score: 0.8 },
    ];

    expect(dedupeByBodyKey(items).map((i) => i.bodyKey)).toEqual(["b", "a"]);
  });
});

describe("snippetFromMd", () => {
  it("題の行を落として本文を返す", () => {
    expect(snippetFromMd("# 題\n\n本文1\n本文2")).toBe("本文1 本文2");
  });

  // 2 個目以降の chunk には題が入っていない。
  it("題が無い chunk はそのまま本文にする", () => {
    expect(snippetFromMd("途中の本文")).toBe("途中の本文");
  });

  it("見出しと箇条書きと引用の記号を落とす", () => {
    expect(snippetFromMd("## 見出し\n- 項目\n  - 子項目\n> 引用")).toBe(
      "見出し 項目 子項目 引用",
    );
  });

  it("長すぎる本文は打ち切る", () => {
    expect(snippetFromMd(`# 題\n\n${"あ".repeat(300)}`, 10)).toBe(
      `${"あ".repeat(10)}…`,
    );
  });
});
