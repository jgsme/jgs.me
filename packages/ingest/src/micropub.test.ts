import { describe, expect, it } from "vitest";
import { buildCreateR2Put } from "./micropub";

// handleMicropubCreate が R2 に書く内容 (body.test.ts / bodyKey.test.ts が別々に
// 保証している buildSbBody と r2KeyOf を、実際に create の配線でどう組み合わせて
// いるか) を固定する。誰かが handleMicropubCreate を書き換えて
// env.R2.put(r2Key, entry.content) のように buildSbBody を経由させなくしても、
// buildCreateR2Put 単体のテストだけでは検出できないが、handleMicropubCreate
// 側がこの関数を呼ばなくなったこと自体はレビューで目立つ変更になる。
// この不変条件 (1行目に題) が壊れると本文の1行目が黙って消える。
describe("buildCreateR2Put", () => {
  it("body の1行目が題、2行目以降が渡した content になる", () => {
    const put = buildCreateR2Put("題", "本文1\n本文2");
    expect(put).not.toBeNull();
    expect(put?.body).toBe("題\n本文1\n本文2");
    expect(put?.body.split("\n")[0]).toBe("題");
  });

  it("content が空でも題の行は残る", () => {
    const put = buildCreateR2Put("題", "");
    expect(put?.body).toBe("題\n");
  });

  it("bodyKey は sb- で始まり、r2Key はその .sb になる (micropub-sb 形式)", () => {
    const put = buildCreateR2Put("題", "本文");
    expect(put?.bodyKey.startsWith("sb-")).toBe(true);
    expect(put?.r2Key).toBe(`${put?.bodyKey}.sb`);
  });

  it("contentType は text/plain; charset=utf-8", () => {
    const put = buildCreateR2Put("題", "本文");
    expect(put?.contentType).toBe("text/plain; charset=utf-8");
  });

  it("呼ぶたびに bodyKey / r2Key が変わる", () => {
    const a = buildCreateR2Put("題", "本文");
    const b = buildCreateR2Put("題", "本文");
    expect(a?.bodyKey).not.toBe(b?.bodyKey);
  });
});
