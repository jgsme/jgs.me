import { describe, expect, it } from "vitest";
import { nextActiveIndex } from "./suggestNav";

// -1 は「候補を選んでいない = 入力欄そのもの」を表す。
describe("nextActiveIndex", () => {
  it("未選択から下に進むと先頭を選ぶ", () => {
    expect(nextActiveIndex(-1, 3, 1)).toBe(0);
  });

  it("下に進むと次の候補に移る", () => {
    expect(nextActiveIndex(0, 3, 1)).toBe(1);
  });

  // 末尾で止めずに入力欄へ戻す。打った文字列で検索し直せる。
  it("末尾から下に進むと未選択に戻る", () => {
    expect(nextActiveIndex(2, 3, 1)).toBe(-1);
  });

  it("未選択から上に進むと末尾を選ぶ", () => {
    expect(nextActiveIndex(-1, 3, -1)).toBe(2);
  });

  it("先頭から上に進むと未選択に戻る", () => {
    expect(nextActiveIndex(0, 3, -1)).toBe(-1);
  });

  it("候補が無いときは未選択のまま", () => {
    expect(nextActiveIndex(-1, 0, 1)).toBe(-1);
    expect(nextActiveIndex(-1, 0, -1)).toBe(-1);
  });

  // 候補が減った後に古い index が残ることがある。選択は壊れているので、
  // 未選択から押し直したのと同じ扱いにする。
  it("範囲外の index は未選択として扱う", () => {
    expect(nextActiveIndex(9, 3, 1)).toBe(0);
    expect(nextActiveIndex(9, 3, -1)).toBe(2);
  });
});
