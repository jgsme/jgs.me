import { describe, expect, it } from "vitest";
import {
  PULL_COMMAND,
  buildCommandsPayload,
  pullResultMessage,
} from "./commands";

describe("buildCommandsPayload", () => {
  it("pull コマンドだけを chat input として登録する", () => {
    expect(buildCommandsPayload()).toEqual([
      {
        name: "pull",
        description: "未登録の記事を今すぐ流す",
        type: 1,
        contexts: [0],
      },
    ]);
  });

  it("PULL_COMMAND は payload の name と一致する", () => {
    expect(buildCommandsPayload()[0].name).toBe(PULL_COMMAND);
  });
});

describe("pullResultMessage", () => {
  it("0 件なら流すものが無いと返す", () => {
    expect(pullResultMessage(0)).toBe("全部片付いてる。流すものなし");
  });

  it("1 件以上なら件数を返す", () => {
    expect(pullResultMessage(1)).toBe("1 件流した");
    expect(pullResultMessage(7)).toBe("7 件流した");
  });
});
