import { describe, expect, it } from "vitest";
import { articlePath, clipPath, druckPath } from "./permalink";

describe("articlePath", () => {
  it("article の permalink は /a/:id", () => {
    expect(articlePath(12)).toBe("/a/12");
  });
});

describe("clipPath", () => {
  it("clip の permalink は /c/:id", () => {
    expect(clipPath(34)).toBe("/c/34");
  });
});

describe("druckPath", () => {
  it("druck の permalink は /d/:id", () => {
    expect(druckPath(7)).toBe("/d/7");
  });
});
