// iframe 内の高さを親に知らせる script。内容が変わるたびに送る
const SHIM = `<script>(function(){var e=document.documentElement;function s(){parent.postMessage({xhtmHeight:Math.ceil(e.getBoundingClientRect().height)},"*")}new ResizeObserver(s).observe(e);addEventListener("load",s);s()})()</script>`;

// 最後の </body> の直前に高さ通知を入れる。無ければ末尾
export function withHeightShim(html: string): string {
  const i = html.toLowerCase().lastIndexOf("</body>");
  if (i === -1) return html + SHIM;
  return html.slice(0, i) + SHIM + html.slice(i);
}

// iframe から届いた message の高さ。形が違えば null
export function readXhtmHeight(data: unknown): number | null {
  if (typeof data !== "object" || data === null) return null;
  const h = (data as { xhtmHeight?: unknown }).xhtmHeight;
  return typeof h === "number" && Number.isFinite(h) && h > 0 ? h : null;
}
