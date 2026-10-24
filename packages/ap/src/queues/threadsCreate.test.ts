import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env, ThreadsCreateMessage } from "../db";
import { GrainNotIndexedError } from "../threads/grain";

vi.mock("../threads/post", () => ({ createContainer: vi.fn() }));
vi.mock("../notify", () => ({ notifyDiscord: vi.fn() }));

import { notifyDiscord } from "../notify";
import { createContainer } from "../threads/post";
import { runThreadsCreate } from "./threadsCreate";

const send = vi.fn();
const env = {
  THREADS_PUBLISH: { send },
  DISCORD_REACTION_WEBHOOK: "https://discord.example/hook",
} as unknown as Env;

function run(attempts: number) {
  const msg = {
    body: { pageID: 1 },
    attempts,
    ack: vi.fn(),
    retry: vi.fn(),
  };
  const batch = {
    messages: [msg],
  } as unknown as MessageBatch<ThreadsCreateMessage>;
  return { msg, done: runThreadsCreate(batch, env) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runThreadsCreate", () => {
  it("GrainNotIndexedError は 60 秒遅延で retry する", async () => {
    vi.mocked(createContainer).mockRejectedValue(
      new GrainNotIndexedError("at://x"),
    );
    const { msg, done } = run(1);
    await done;
    expect(msg.retry).toHaveBeenCalledWith({ delaySeconds: 60 });
    expect(msg.ack).not.toHaveBeenCalled();
  });

  it("それ以外の Error は遅延なしで retry する", async () => {
    vi.mocked(createContainer).mockRejectedValue(new Error("boom"));
    const { msg, done } = run(1);
    await done;
    expect(msg.retry).toHaveBeenCalledWith();
  });

  it("最終試行の GrainNotIndexedError は取り込まれていない旨を通知する", async () => {
    vi.mocked(createContainer).mockRejectedValue(
      new GrainNotIndexedError("at://x"),
    );
    const { done } = run(4);
    await done;
    const text = vi.mocked(notifyDiscord).mock.calls[0]![1];
    expect(text).toContain("grain.social");
    expect(text).toContain("取り込まれていない");
  });

  it("creationID が返れば 30 秒遅延で publish に送り ack する", async () => {
    vi.mocked(createContainer).mockResolvedValue("c1");
    const { msg, done } = run(1);
    await done;
    expect(send).toHaveBeenCalledWith(
      { pageID: 1, creationID: "c1" },
      { delaySeconds: 30 },
    );
    expect(msg.ack).toHaveBeenCalled();
  });
});
