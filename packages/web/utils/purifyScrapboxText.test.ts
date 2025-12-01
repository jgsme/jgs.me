import { describe, it, expect } from "vitest";
import { purifyScrapboxText } from "./purifyScrapboxText";

describe("purifyScrapboxText", () => {
  it("リンク記法 [text] を除去する", () => {
    expect(purifyScrapboxText("[Netflix] を見た")).toBe("Netflix を見た");
  });

  it("二重リンク記法 [[text]] を除去する", () => {
    expect(purifyScrapboxText("[[太字]] のテキスト")).toBe("太字 のテキスト");
  });

  it("装飾記法 [* text] を除去する", () => {
    expect(purifyScrapboxText("[* 強調] されたテキスト")).toBe(
      "強調 されたテキスト"
    );
    expect(purifyScrapboxText("[** 太字強調] テスト")).toBe("太字強調 テスト");
    expect(purifyScrapboxText("[/ 斜体] テスト")).toBe("斜体 テスト");
    expect(purifyScrapboxText("[- 打ち消し] テスト")).toBe("打ち消し テスト");
  });

  it("URL単体のリンクを除去する", () => {
    expect(purifyScrapboxText("[https://example.com]")).toBe("");
  });

  it("URL付きリンク [URL text] からテキストのみ抽出する", () => {
    expect(purifyScrapboxText("[https://example.com リンク]")).toBe("リンク");
  });

  it("ハッシュタグを除去する", () => {
    expect(purifyScrapboxText("テスト #tag1 #20241201")).toBe("テスト");
  });

  it("コードブロック行を除去する", () => {
    expect(purifyScrapboxText("code:test.js\nconst x = 1")).toBe("const x = 1");
    expect(purifyScrapboxText("table:data\nrow1")).toBe("row1");
  });

  it("インラインコードを除去する", () => {
    expect(purifyScrapboxText("テスト `code` です")).toBe("テスト です");
  });

  it("画像・アイコン記法を除去する", () => {
    expect(purifyScrapboxText("[user.icon]")).toBe("");
    expect(purifyScrapboxText("[https://example.com/image.jpg]")).toBe("");
    expect(purifyScrapboxText("[https://gyazo.com/abc123]")).toBe("");
  });

  it("引用記法の > を除去する", () => {
    expect(purifyScrapboxText("> 引用テキスト")).toBe("引用テキスト");
  });

  it("インデントを除去する", () => {
    expect(purifyScrapboxText("\tインデントされたテキスト")).toBe(
      "インデントされたテキスト"
    );
    expect(purifyScrapboxText("  スペースインデント")).toBe(
      "スペースインデント"
    );
  });

  it("連続する空白を1つにまとめる", () => {
    expect(purifyScrapboxText("テスト   複数   空白")).toBe("テスト 複数 空白");
  });

  it("複合的なケースを処理できる", () => {
    const input = `[Netflix] のラインナップをザッピングしてたら、[伊藤潤二]原作で [Adult Swim] x [Production I.G] ていう座組
	[A24] と同じくらい [Adult Swim] は箱推し
	#20251125`;
    const expected =
      "Netflix のラインナップをザッピングしてたら、伊藤潤二原作で Adult Swim x Production I.G ていう座組 A24 と同じくらい Adult Swim は箱推し";
    expect(purifyScrapboxText(input)).toBe(expected);
  });

  it("gyazo画像を含む記事を処理できる (学マス 2025-Q2 recap)", () => {
    const input = `[学マス] 2025-Q2 recap
	[学マス 秦谷美鈴 True End 編 感想 (ネタバレあり)]以来、多忙すぎて書いてるヒマがなくて、ざっと見返す

	[https://gyazo.com/6ab2e0e7ea7078a4210b15fd4ece2b02]
	やばそうなペア
	[https://gyazo.com/7506310a1e76bd8b810826ef3f225570]
	でしょうね`;
    const expected =
      "学マス 2025-Q2 recap 学マス 秦谷美鈴 True End 編 感想 (ネタバレあり)以来、多忙すぎて書いてるヒマがなくて、ざっと見返す やばそうなペア でしょうね";
    expect(purifyScrapboxText(input)).toBe(expected);
  });

  it("外部プロジェクトリンクを含む記事を処理できる (全身全霊会社員)", () => {
    const input = `そしたら [juneboku] が大阪に越したばかりとのことだったのでオフラインではすんごい久しぶりに会った
	[/juneboku/2025-05-31 Sat : 梅田で友だちとお好み焼き#683b0e140000000000af9a16]`;
    const expected =
      "そしたら juneboku が大阪に越したばかりとのことだったのでオフラインではすんごい久しぶりに会った /juneboku/2025-05-31 Sat : 梅田で友だちとお好み焼き";
    expect(purifyScrapboxText(input)).toBe(expected);
  });

  it("YouTube URLを含む記事を処理できる (全身全霊会社員)", () => {
    const input = `外向きには
	[https://www.youtube.com/watch?v=Oh-r34rrM6c]
	の配信スタッフをやった`;
    const expected = "外向きには の配信スタッフをやった";
    expect(purifyScrapboxText(input)).toBe(expected);
  });

  it("AI・技術系の長文記事を処理できる (Nexus 聞き終わった)", () => {
    const input = `[サピエンス全史]、[ホモ・デウス]に続いて
	前二著は結構楽観的というか、まあ歴史家としての本領といった感じがしたのだが、今回は生成まわりのテクノロジー全般を指して [Alien Intelligence] と呼称してみたりしてやや opinionated な調子が上下巻を通して感じられた
		わかりやすい喩えとして、タイプライターはそれそのものが[聖書]を書き出したり、デマを書き出したりすることはないし、[ラジオ]はそれそのものが[玉音放送]を鳴らしたりはしないわけだが`;
    const expected =
      "サピエンス全史、ホモ・デウスに続いて 前二著は結構楽観的というか、まあ歴史家としての本領といった感じがしたのだが、今回は生成まわりのテクノロジー全般を指して Alien Intelligence と呼称してみたりしてやや opinionated な調子が上下巻を通して感じられた わかりやすい喩えとして、タイプライターはそれそのものが聖書を書き出したり、デマを書き出したりすることはないし、ラジオはそれそのものが玉音放送を鳴らしたりはしないわけだが";
    expect(purifyScrapboxText(input)).toBe(expected);
  });

  it("複数のリンクが連続する文を処理できる", () => {
    const input = `[Google] や [OpenAI]、[Anthropic] の閉じた環境で改良が行われている`;
    const expected =
      "Google や OpenAI、Anthropic の閉じた環境で改良が行われている";
    expect(purifyScrapboxText(input)).toBe(expected);
  });

  it("深いインデントを含む記事を処理できる", () => {
    const input = `雑用1: [LLM] を使って[社内報]のようなモノを作っている
			そういえば新卒の頃も社内報書いてたな〜みたいな
		雑用2: [PA]業
			妙に音響機材が揃うタイプの会社で、ややテクニカルに大変なので手伝っている`;
    const expected =
      "雑用1: LLM を使って社内報のようなモノを作っている そういえば新卒の頃も社内報書いてたな〜みたいな 雑用2: PA業 妙に音響機材が揃うタイプの会社で、ややテクニカルに大変なので手伝っている";
    expect(purifyScrapboxText(input)).toBe(expected);
  });
});
