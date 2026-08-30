import { describe, expect, it } from "vitest";
import type { Entry } from "./mf2";
import { firstImageURL, pageImage } from "./firstImage";

const JPG = "https://r2.jgs.me/abc.jpg";
const PNG = "https://r2.jgs.me/def.png";

describe("firstImageURL", () => {
  it("画像が無ければ null", () => {
    expect(firstImageURL("ただの本文\nもう1行")).toBeNull();
  });

  it("画像記法の URL を返す", () => {
    expect(firstImageURL(`本文\n[${JPG}]\n続き`)).toBe(JPG);
  });

  it("複数あっても先頭を返す", () => {
    expect(firstImageURL(`[${JPG}]\n[${PNG}]`)).toBe(JPG);
  });

  // 画像でないリンクを拾うと、記事と無関係なページの URL がサムネになる。
  it("画像でないリンクは拾わない", () => {
    expect(firstImageURL("[https://example.com/index.html]")).toBeNull();
  });

  // 装飾の中に置いた画像も本文では画像として出る。拾う側だけ取りこぼさない。
  it("装飾の中の画像も拾う", () => {
    expect(firstImageURL(`[[${JPG}]]`)).toBe(JPG);
  });

  // code ブロックの中身は本文では画像にならない。URL だけ見て拾うと
  // 貼り付けたコード片の URL がサムネになってしまう。
  it("コードブロックの中の URL は拾わない", () => {
    expect(firstImageURL(`code:sample\n  const u = "${JPG}"`)).toBeNull();
  });

  it("空文字でも落ちない", () => {
    expect(firstImageURL("")).toBeNull();
  });
});

describe("pageImage", () => {
  const entry = (photo: string | null, content: string) =>
    ({ photo, content }) as Entry;

  // photo は投稿者が明示したサムネなので、本文の先頭より優先する。
  it("photo があればそれを使う", () => {
    expect(pageImage(entry(PNG, `[${JPG}]`))).toBe(PNG);
  });

  it("photo が無ければ本文の先頭画像を使う", () => {
    expect(pageImage(entry(null, `本文\n[${JPG}]`))).toBe(JPG);
  });

  it("どちらも無ければ null", () => {
    expect(pageImage(entry(null, "画像の無い本文"))).toBeNull();
  });
});
