import { describe, expect, it } from "vitest";
import { buildSbBody } from "./body";

describe("buildSbBody", () => {
  it("1行目に題、2行目以降に本文を置く", () => {
    expect(buildSbBody("題", "本文1\n本文2")).toBe("題\n本文1\n本文2");
  });

  it("本文が空でも題の行は残る", () => {
    expect(buildSbBody("題", "")).toBe("題\n");
  });

  it("本文の先頭行をそのまま2行目にする (題として食われない)", () => {
    const out = buildSbBody("題", "先頭行");
    expect(out.split("\n")[1]).toBe("先頭行");
  });
});
