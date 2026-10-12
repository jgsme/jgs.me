import { expect, it } from "vitest";
import { pagePath } from "./pagePath";

it("題を encodeURIComponent してパスにする", () => {
  expect(pagePath("a b/c?d#e&f")).toBe("/pages/a%20b%2Fc%3Fd%23e%26f");
});

// React は属性値の ' を &#x27; にする。生の HTML から href を抜く外形監視が
// &#x27; ごと叩き、& 以降がクエリになって別のページを引いていた。
it("' もパーセントエンコードする", () => {
  expect(pagePath("Hawtin's DJ")).toBe("/pages/Hawtin%27s%20DJ");
});
