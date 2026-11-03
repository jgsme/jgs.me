import { afterEach, expect, it, vi } from "vitest";
import { fetchBody } from "@jigsaw/db/fetch-body";
import data from "./+data";

// page 行は引けない体にして、本文 (fetchBody) だけ返す。
vi.mock("@/db/getDB", () => {
  const query: Record<string, unknown> = {};
  ["select", "from", "leftJoin", "where"].forEach((m) => {
    query[m] = () => query;
  });
  query.limit = async () => [];
  return { getDB: () => query };
});
vi.mock("@jigsaw/db/fetch-body", () => ({ fetchBody: vi.fn() }));
vi.mock("@/server/zetByTitle", () => ({
  findZetRkeyByTitle: vi.fn(async () => null),
}));
vi.mock("vike-react/useConfig", () => ({ useConfig: () => () => {} }));

afterEach(() => {
  vi.restoreAllMocks();
});

// sha256 の 16 進は 64 文字
const SHA_HEX_LEN = 64;
const GOOD = `${"a".repeat(SHA_HEX_LEN)}.json`;
const BROKEN = `${"b".repeat(SHA_HEX_LEN)}.json`;
const MISSING = `${"c".repeat(SHA_HEX_LEN)}.json`;
const PART = { styles: [], libs: [], body: "<p>a</p>", scripts: [] };

const body = [
  "題",
  "前",
  "code:xhtm",
  ` {"key":"${GOOD}"}`,
  "code:xhtm",
  ` {"key":"${BROKEN}"}`,
  "code:xhtm",
  ` {"key":"${MISSING}"}`,
  "code:xhtm",
  " <div>キーでない中身</div>",
  "後",
].join("\n");

const MEDIA = {
  get: vi.fn(async (k: string) => {
    if (k === GOOD) return { json: async () => PART };
    if (k === BROKEN)
      return {
        json: async () => {
          throw new SyntaxError("bad json");
        },
      };
    return null;
  }),
};

it("本文の code:xhtm の部品を読み、読めないものは載せずにページを返す", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(fetchBody).mockResolvedValue(body);
  const d = await data({
    urlOriginal: "https://w.jgs.me/pages/%E9%A1%8C",
    env: { MEDIA },
  } as unknown as Parameters<typeof data>[0]);

  expect(d.ok).toBe(true);
  if (!d.ok || "view" in d) return;
  expect(d.xhtm).toEqual({ [GOOD]: PART });
});
