import { describe, expect, it } from "vitest";
import {
  chunk,
  formatScanReport,
  nextLimit,
  SERVER_DEFAULT_LIMIT,
  uniqueHashes,
  type ProbeItem,
  type ScanItem,
} from "./gyazoReport.ts";

const A = "0123456789abcdef0123456789abcdef";
const B = "fedcba9876543210fedcba9876543210";

const items: ScanItem[] = [
  { pageId: 1, title: "あ", hashes: [A, B], imageHash: A, scrapboxFiles: 0 },
  { pageId: 2, title: "い", hashes: [A], imageHash: null, scrapboxFiles: 3 },
  { pageId: 3, title: "う", hashes: [], imageHash: null, scrapboxFiles: 0 },
];

const probes: ProbeItem[] = [
  { gyazoHash: A, status: 200, bytes: 1000, contentType: "image/png" },
  { gyazoHash: B, status: 403, bytes: null, contentType: null },
];

describe("uniqueHashes", () => {
  it("本文と image のハッシュをまとめて重複を潰す", () => {
    expect(uniqueHashes(items).sort()).toEqual([A, B].sort());
  });
});

describe("chunk", () => {
  it("指定した大きさに割る", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("空なら空", () => {
    expect(chunk([], 2)).toEqual([]);
  });
});

describe("formatScanReport", () => {
  const out = formatScanReport(items, probes);

  it("対象と Gyazo を含む article 数を出す", () => {
    expect(out).toContain("対象 article: 3");
    expect(out).toContain("Gyazo を含む article: 2");
  });

  it("ユニーク枚数と延べ参照数を出す", () => {
    expect(out).toContain("ユニーク画像: 2");
    expect(out).toContain("延べ参照: 3");
  });

  it("status 別の内訳を出す", () => {
    expect(out).toContain("200: 1");
    expect(out).toContain("403: 1");
  });

  // 取り込めない画像は参照元まで出す。手で追えるようにするため。
  it("200 以外は参照元 page 付きで並べる", () => {
    expect(out).toContain(`${B} (403) <- 1 あ`);
  });

  it("総バイト数を出す", () => {
    expect(out).toContain("総バイト: 1000");
  });

  it("page.image が Gyazo の page 数を出す", () => {
    expect(out).toContain("page.image が Gyazo: 1");
  });

  it("scrapbox.io/files の出現数を出す", () => {
    expect(out).toContain("scrapbox.io/files: 3");
  });

  // page.image が本文中と同じハッシュを指すことがある (Scrapbox では実際にありがち)。
  // 参照元を二重に数えると判断材料として誤読させる。
  it("同じ page が本文と image の両方で同じハッシュを参照していても 1 回だけ出す", () => {
    const dupItems: ScanItem[] = [
      { pageId: 1, title: "え", hashes: [A], imageHash: A, scrapboxFiles: 0 },
    ];
    const dupProbes: ProbeItem[] = [
      { gyazoHash: A, status: 404, bytes: null, contentType: null },
    ];
    const dupOut = formatScanReport(dupItems, dupProbes);
    expect(dupOut).toContain(`${A} (404) <- 1 え`);
    expect(dupOut).not.toContain(`${A} (404) <- 1 え, 1 え`);
  });
});

describe("nextLimit", () => {
  it("maxPages が無指定ならサーバ既定を使う", () => {
    expect(nextLimit(null, 0)).toBe(SERVER_DEFAULT_LIMIT);
  });

  it("maxPages がサーバ既定より小さいとき、残り分に切る", () => {
    expect(nextLimit(5, 0)).toBe(5);
  });

  it("途中まで進んでいたら残り分に切る", () => {
    expect(nextLimit(25, 20)).toBe(5);
  });

  it("maxPages がサーバ既定より大きくても 1 回はサーバ既定で頭打ち", () => {
    expect(nextLimit(100, 0)).toBe(SERVER_DEFAULT_LIMIT);
  });

  it("既に上限ちょうどに達していたら 0", () => {
    expect(nextLimit(5, 5)).toBe(0);
  });

  it("上限を超えていても負にはならない", () => {
    expect(nextLimit(5, 10)).toBe(0);
  });
});
