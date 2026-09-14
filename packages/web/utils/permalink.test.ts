import { describe, expect, it } from "vitest";
import { articlePath, clipPath } from "./permalink";

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
