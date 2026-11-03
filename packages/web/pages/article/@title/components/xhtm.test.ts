import { describe, expect, it } from "vitest";
import { readXhtmHeight, withHeightShim } from "./xhtm";

describe("withHeightShim", () => {
  it("</body> の直前に script を入れる", () => {
    const out = withHeightShim("<html><body><p>a</p></body></html>");
    expect(out.indexOf("<script")).toBeLessThan(out.indexOf("</body>"));
    expect(out.match(/<\/body>/g)).toHaveLength(1);
  });

  it("</body> が無ければ末尾に足す", () => {
    const out = withHeightShim("<p>a</p>");
    expect(out.startsWith("<p>a</p>")).toBe(true);
    expect(out.endsWith("</script>")).toBe(true);
  });

  it("最後の </body> (大文字小文字を問わない) の前に入れる", () => {
    const html = '<body><script>const s = "</body>";</script></BODY>';
    const out = withHeightShim(html);
    expect(out.startsWith(html.slice(0, -"</BODY>".length))).toBe(true);
    expect(out.endsWith("</BODY>")).toBe(true);
    expect(out.lastIndexOf("<script")).toBeGreaterThan(
      out.indexOf('"</body>";</script>'),
    );
  });
});

describe("withHeightShim (補足)", () => {
  it("小文字化で長さが変わる文字があっても </body> の直前に入る", () => {
    const html = "<body><p>İİİ</p></body>";
    const out = withHeightShim(html);
    const i = out.lastIndexOf("</body>");
    expect(out.slice(i)).toBe("</body>");
    expect(out.slice(0, out.indexOf("<script"))).toBe("<body><p>İİİ</p>");
    expect(out.replace(/<script>.*<\/script>/s, "")).toBe(html);
  });

  it("親からの xhtmMeasure で高さを送り直す", () => {
    expect(withHeightShim("<p>a</p>")).toContain("xhtmMeasure");
  });
});

describe("readXhtmHeight", () => {
  it("有限の正の数だけ通す", () => {
    expect(readXhtmHeight({ xhtmHeight: 321 })).toBe(321);
    expect(readXhtmHeight({ xhtmHeight: "321" })).toBeNull();
    expect(readXhtmHeight({ xhtmHeight: -1 })).toBeNull();
    expect(readXhtmHeight({ xhtmHeight: Infinity })).toBeNull();
    expect(readXhtmHeight(null)).toBeNull();
    expect(readXhtmHeight({ jgsHeight: 3 })).toBeNull();
  });
});
