import { describe, expect, it } from "vitest";
import { thumbURL } from "./thumbURL";

describe("thumbURL", () => {
  it("R2 の URL は /cdn-cgi/image/ 経由に組み替える", () => {
    expect(thumbURL("https://r2.jgs.me/abc123.png")).toBe(
      "https://r2.jgs.me/cdn-cgi/image/width=400,format=auto,onerror=redirect/abc123.png",
    );
  });

  it("R2 の URL で size を指定できる", () => {
    expect(thumbURL("https://r2.jgs.me/abc123.png", 100)).toBe(
      "https://r2.jgs.me/cdn-cgi/image/width=100,format=auto,onerror=redirect/abc123.png",
    );
  });

  // 移行しない page が残るので Gyazo の分岐は生かしたまま。
  it("Gyazo の /raw は /thumb/<size> に差し替える", () => {
    expect(thumbURL("https://gyazo.com/abc123/raw")).toBe(
      "https://gyazo.com/abc123/thumb/400",
    );
  });

  it("Gyazo でも R2 でもない URL はそのまま返す", () => {
    expect(thumbURL("https://example.com/a.png")).toBe(
      "https://example.com/a.png",
    );
  });

  // r2.jgs.me を名前に含むだけの別ホストを R2 と誤認しない。
  it("ホスト名が前方一致するだけの URL は素通しする", () => {
    expect(thumbURL("https://r2.jgs.me.evil.example/a.png")).toBe(
      "https://r2.jgs.me.evil.example/a.png",
    );
  });
});
