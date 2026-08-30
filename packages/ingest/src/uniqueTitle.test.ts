import { describe, expect, it } from "vitest";
import { pickUniqueTitle } from "./uniqueTitle";

describe("pickUniqueTitle", () => {
  it("重複していなければ base をそのまま返す", () => {
    expect(pickUniqueTitle("題", new Set())).toBe("題");
  });

  it("base が使われていたら (1) を付ける", () => {
    expect(pickUniqueTitle("題", new Set(["題"]))).toBe("題 (1)");
  });

  it("(1) も使われていたら (2) に進む", () => {
    expect(pickUniqueTitle("題", new Set(["題", "題 (1)"]))).toBe("題 (2)");
  });

  // 途中が空いていたらそこを埋める。常に最大値 +1 にすると番号が無駄に伸びる。
  it("途中が空いていればその番号を使う", () => {
    expect(pickUniqueTitle("題", new Set(["題", "題 (2)"]))).toBe("題 (1)");
  });

  // 別の題の suffix 付きが existing に混ざっても base の採番には影響しない。
  it("無関係な題が集合にあっても base をそのまま返す", () => {
    expect(pickUniqueTitle("題", new Set(["別の題", "別の題 (1)"]))).toBe("題");
  });

  it("空文字の base でも落ちない", () => {
    expect(pickUniqueTitle("", new Set([""]))).toBe(" (1)");
  });
});
