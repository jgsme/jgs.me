import { describe, expect, it } from "vitest";
import { buildRssXml, type RssFeedItem } from "./rssFeed";

const SITE_URL = "https://w.jgs.me";
const LAST_BUILD = new Date("2026-08-24T02:00:00Z");

const item = (over: Partial<RssFeedItem> = {}): RssFeedItem => ({
  title: "タイトル",
  created: "2026-08-24 01:21:57",
  description: "本文の冒頭",
  ...over,
});

const build = (items: RssFeedItem[]) =>
  buildRssXml({ items, siteUrl: SITE_URL, lastBuildDate: LAST_BUILD });

describe("buildRssXml", () => {
  it("フィード自身を指す atom:link rel=self を持つ", () => {
    const xml = build([item()]);
    expect(xml).toContain('xmlns:atom="http://www.w3.org/2005/Atom"');
    expect(xml).toContain(
      '<atom:link href="https://w.jgs.me/rss.xml" rel="self" type="application/rss+xml"/>',
    );
  });

  it("lastBuildDate を RFC 822 で出す", () => {
    const xml = build([item()]);
    expect(xml).toContain(
      "<lastBuildDate>Mon, 24 Aug 2026 02:00:00 GMT</lastBuildDate>",
    );
  });

  it("item に description を入れる", () => {
    const xml = build([item({ description: "本文の冒頭" })]);
    expect(xml).toContain("<description>本文の冒頭</description>");
  });

  // 本文が取れなかったページで空の description を出しても意味がない。
  it("description が null なら item に description を出さない", () => {
    const xml = build([item({ description: null })]);
    expect(xml).toContain("<item>");
    const itemBlock = xml.slice(xml.indexOf("<item>"));
    expect(itemBlock).not.toContain("<description>");
  });

  it("description を XML エスケープする", () => {
    const xml = build([item({ description: 'a & b <tag> "q"' })]);
    expect(xml).toContain(
      "<description>a &amp; b &lt;tag&gt; &quot;q&quot;</description>",
    );
  });

  it("title を XML エスケープする", () => {
    const xml = build([item({ title: "R&D <hr>" })]);
    expect(xml).toContain("<title>R&amp;D &lt;hr&gt;</title>");
  });

  // DB の created は SQLite の CURRENT_TIMESTAMP (UTC)。
  // ローカルタイムとして解釈すると実行環境の TZ ぶんずれる。
  it("created を UTC として pubDate にする", () => {
    const xml = build([item({ created: "2026-08-24 01:21:57" })]);
    expect(xml).toContain("<pubDate>Mon, 24 Aug 2026 01:21:57 GMT</pubDate>");
  });

  it("link と guid をタイトルから組み立てる", () => {
    const xml = build([item({ title: "祝 学マス" })]);
    const link =
      "https://w.jgs.me/pages/%E7%A5%9D%20%E5%AD%A6%E3%83%9E%E3%82%B9";
    expect(xml).toContain(`<link>${link}</link>`);
    expect(xml).toContain(`<guid>${link}</guid>`);
  });

  it("item が空でも channel を返す", () => {
    const xml = build([]);
    expect(xml).toContain("<channel>");
    expect(xml).not.toContain("<item>");
  });
});

describe("buildRssXml の feed 指定", () => {
  it("title と selfPath を省略すると今までの値になる", () => {
    const xml = build([item()]);
    expect(xml).toContain("<title>I am Electrical machine</title>");
    expect(xml).toContain(
      '<atom:link href="https://w.jgs.me/rss.xml" rel="self" type="application/rss+xml"/>',
    );
  });

  // reader は複数の feed を title で見分ける。同じ題の 2 本は区別できない。
  it("title と selfPath を渡すとそちらが出る", () => {
    const xml = buildRssXml({
      items: [item()],
      siteUrl: SITE_URL,
      lastBuildDate: LAST_BUILD,
      title: "I am Electrical machine - Clips",
      selfPath: "/clips.xml",
    });

    expect(xml).toContain("<title>I am Electrical machine - Clips</title>");
    expect(xml).toContain(
      '<atom:link href="https://w.jgs.me/clips.xml" rel="self" type="application/rss+xml"/>',
    );
  });

  it("item の link は title 指定に影響されない", () => {
    const xml = buildRssXml({
      items: [item({ title: "clip の題" })],
      siteUrl: SITE_URL,
      lastBuildDate: LAST_BUILD,
      title: "Clips",
      selfPath: "/clips.xml",
    });

    expect(xml).toContain(
      `<link>https://w.jgs.me/pages/${encodeURIComponent("clip の題")}</link>`,
    );
  });
});
