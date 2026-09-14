import { describe, expect, it } from "vitest";
import { buildRssXml, type RssFeedItem } from "./rssFeed";

const SITE_URL = "https://w.jgs.me";
const LAST_BUILD = new Date("2026-08-24T02:00:00Z");

const item = (over: Partial<RssFeedItem> = {}): RssFeedItem => ({
  title: "タイトル",
  linkPath: "/a/1",
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

  // link/guid は /pages/<title> ではなく permalink。題を変えても URL が
  // 変わらないので、reader 側で同じ item が二度出ない。
  it("link と guid を linkPath から組み立てる", () => {
    const xml = build([item({ title: "祝 学マス", linkPath: "/a/12" })]);
    expect(xml).toContain("<link>https://w.jgs.me/a/12</link>");
    expect(xml).toContain("<guid>https://w.jgs.me/a/12</guid>");
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
      items: [item({ title: "clip の題", linkPath: "/c/34" })],
      siteUrl: SITE_URL,
      lastBuildDate: LAST_BUILD,
      title: "Clips",
      selfPath: "/clips.xml",
    });

    expect(xml).toContain("<link>https://w.jgs.me/c/34</link>");
  });
});
