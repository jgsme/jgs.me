const enc = new TextEncoder();

export type Facet = {
  $type: "app.bsky.richtext.facet";
  index: { byteStart: number; byteEnd: number };
  features: { $type: "app.bsky.richtext.facet#link"; uri: string }[];
};

// facets の index は UTF-8 バイト単位。文字位置ではない。
// 日本語は1文字 3 バイト、絵文字は 4 バイトなので、
// 文字位置をそのまま使うと必ずずれてリンクが崩れる。
function byteLength(s: string): number {
  return enc.encode(s).length;
}

export function linkFacets(
  text: string,
  links: { uri: string; label: string }[],
): Facet[] {
  const out: Facet[] = [];

  for (const { uri, label } of links) {
    if (!label) continue;
    const at = text.indexOf(label);
    if (at < 0) continue;

    const byteStart = byteLength(text.slice(0, at));
    const byteEnd = byteStart + byteLength(label);

    out.push({
      $type: "app.bsky.richtext.facet",
      index: { byteStart, byteEnd },
      features: [{ $type: "app.bsky.richtext.facet#link", uri }],
    });
  }

  return out;
}
