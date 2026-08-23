// Micropub の update / delete は対象を URL で指す。
// 自サイトが同じ記事に対して出している URL は 4 種類ある。
//   /pages/<title>  人間向け (create の Location もこれ)
//   /p/<pageID>     共有用の短い URL
//   /o/<pageID>     ActivityPub の正準 id
//   /a/<articleID>  公開登録順の連番。pageID とはズレる
export type Target =
  | { kind: "page"; pageID: number }
  | { kind: "article"; articleID: number }
  | { kind: "title"; title: string };

function positiveInt(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n > 0 ? n : null;
}

export function parseTargetURL(raw: string, siteURL: string): Target {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`url is not a valid URL: ${raw}`);
  }

  const site = new URL(siteURL);
  if (url.origin !== site.origin) {
    throw new Error(`url is not on this site: ${raw}`);
  }

  const segments = url.pathname.split("/").filter((s) => s !== "");

  if (segments.length === 2 && (segments[0] === "p" || segments[0] === "o")) {
    const pageID = positiveInt(segments[1]!);
    if (pageID === null) throw new Error(`url has no valid id: ${raw}`);
    return { kind: "page", pageID };
  }

  if (segments.length === 2 && segments[0] === "a") {
    const articleID = positiveInt(segments[1]!);
    if (articleID === null) throw new Error(`url has no valid id: ${raw}`);
    return { kind: "article", articleID };
  }

  if (segments.length === 2 && segments[0] === "pages") {
    // pathname は percent-encoded のまま。題は生の文字列で持つ。
    const title = decodeURIComponent(segments[1]!);
    if (title === "") throw new Error(`url has no title: ${raw}`);
    return { kind: "title", title };
  }

  throw new Error(`url is not an article URL: ${raw}`);
}
