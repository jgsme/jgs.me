import { describe, expect, it } from "vitest";
import { normalizeDerivedText } from "./htmlConvert";

describe("normalizeDerivedText", () => {
  it("CRLF を LF にし、前後の空行を落とす", () => {
    expect(normalizeDerivedText("\r\n\r\n一行目\r\n二行目 [a]\r\n\r\n")).toBe(
      "一行目\n二行目 [a]",
    );
  });
});
