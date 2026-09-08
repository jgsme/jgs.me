import { describe, it, expect } from "vitest";
import { pageTitleFromUrl } from "./pageTitle";

// Vike の routeParams は使えない。client-side navigation の
// `.pageContext.json` リクエストでは vike が pathname を 1 回余計に
// デコードするため、"#" や "?" を含む title がそこで切れる。
// (vike の handlePageContextRequestUrl → modifyUrl が pathnameOriginal では
//  なく decode 済みの pathname から URL を組み直している)
// pageContext.urlOriginal は素の URL のままなので、そこから自前で取る。
describe("pageTitleFromUrl", () => {
  it("通常のリクエストから title を取る", () => {
    expect(
      pageTitleFromUrl("https://w.jgs.me/pages/pebble%20%E5%BE%A9%E6%B4%BB"),
    ).toBe("pebble 復活");
  });

  it(".pageContext.json のリクエストからも同じ title を取る", () => {
    expect(
      pageTitleFromUrl(
        "https://w.jgs.me/pages/pebble%20%E5%BE%A9%E6%B4%BB/index.pageContext.json",
      ),
    ).toBe("pebble 復活");
  });

  it("# を含む title が切れない", () => {
    expect(
      pageTitleFromUrl(
        "https://w.jgs.me/pages/Get%20your%20%23SupaLaunchWeek%20Ticket/index.pageContext.json",
      ),
    ).toBe("Get your #SupaLaunchWeek Ticket");
  });

  it("? を含む title が切れない", () => {
    expect(
      pageTitleFromUrl(
        "https://w.jgs.me/pages/How%20do%20I%20turn%20autoplay%20on%20or%20off%3F/index.pageContext.json",
      ),
    ).toBe("How do I turn autoplay on or off?");
  });

  it("% を含む title を二重デコードしない", () => {
    expect(
      pageTitleFromUrl(
        "https://w.jgs.me/pages/1u%E3%82%AA%E3%83%B3%E3%83%AA%E3%83%BC%E3%81%AE40-60%25%E3%82%AD%E3%83%BC%E3%83%9C%E3%83%BC%E3%83%89",
      ),
    ).toBe("1uオンリーの40-60%キーボード");
  });

  it("エンコードされていない生の % はそのまま返す", () => {
    expect(pageTitleFromUrl("https://w.jgs.me/pages/40-60%キーボード")).toBe(
      "40-60%キーボード",
    );
  });

  it("%2F はスラッシュに戻す", () => {
    expect(
      pageTitleFromUrl(
        "https://w.jgs.me/pages/dev.to%2Fjgs/index.pageContext.json",
      ),
    ).toBe("dev.to/jgs");
  });

  it("末尾の空白を落とさない", () => {
    expect(
      pageTitleFromUrl(
        "https://w.jgs.me/pages/trailing%20/index.pageContext.json",
      ),
    ).toBe("trailing ");
  });

  it("_vike の search が付いていても無視する", () => {
    expect(
      pageTitleFromUrl(
        'https://w.jgs.me/pages/a%20b/index.pageContext.json?_vike={"previousUrl":"/"}',
      ),
    ).toBe("a b");
  });

  it("title 自体が index.pageContext.json でも壊れない", () => {
    expect(
      pageTitleFromUrl("https://w.jgs.me/pages/index.pageContext.json"),
    ).toBe("index.pageContext.json");
  });
});
