// HTML article の <style> を記事の入れ物のクラスに閉じ込める。
// 要るのはブロック構造とセレクタ一覧の分割だけで値は読まないので、CSS パーサは使わず
// 手書きの字句解析で済ませる (postcss は Node の組み込みを引き、ingest は nodejs_compat を付けていない)。
// 走査は 1 文字ずつ進める状態機械なので、ループで書く。

// 中の規則を再帰で書き換える at-rule。中に普通の規則が並ぶもの
const RECURSE_AT_RULES = new Set([
  "media",
  "supports",
  "container",
  "layer",
  "scope",
  "document",
  "-moz-document",
]);

// エスケープ (\x) とコメントの開き閉じ (/* */) は 2 文字で 1 まとまり
const PAIR = 2;

// i にコメント・文字列・エスケープが始まっていれば、その直後の位置を返す。
// 構造の文字 ({ } , ; など) をそこで数えないために、走査はすべてこれを通す。
// 閉じていなければ末尾まで飛ばす (投げない)
function skipOpaque(s: string, i: number): number | null {
  const c = s[i];
  if (c === "\\") return Math.min(i + PAIR, s.length);
  if (c === "/" && s[i + 1] === "*") {
    const end = s.indexOf("*/", i + PAIR);
    return end < 0 ? s.length : end + PAIR;
  }
  if (c === '"' || c === "'") {
    let j = i + 1;
    while (j < s.length && s[j] !== c) {
      j += s[j] === "\\" ? PAIR : 1;
    }
    return Math.min(j + 1, s.length);
  }
  return null;
}

// from から、() [] の外にある stops のどれかが最初に出る位置を返す。無ければ -1
function findTopLevel(s: string, from: number, stops: string): number {
  let depth = 0;
  let i = from;
  while (i < s.length) {
    const skipped = skipOpaque(s, i);
    if (skipped !== null) {
      i = skipped;
      continue;
    }
    const c = s[i];
    if (depth === 0 && stops.includes(c)) return i;
    if (c === "(" || c === "[") depth++;
    else if ((c === ")" || c === "]") && depth > 0) depth--;
    i++;
  }
  return -1;
}

// open の { に対応する } の位置を返す。釣り合わなければ -1
function matchBrace(s: string, open: number): number {
  let depth = 0;
  let i = open;
  while (i < s.length) {
    const skipped = skipOpaque(s, i);
    if (skipped !== null) {
      i = skipped;
      continue;
    }
    const c = s[i];
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return i;
    i++;
  }
  return -1;
}

// 空白 1 文字。" " や "\n" に当たり、"a" には当たらない
const SPACE = /\s/;

// 前置き (セレクタや at-rule の頭) の前後の空白とコメントを中身から切り離す。
// 書き換えるのは中身だけで、整形 (改行・字下げ) とコメントは元のまま出す
function splitPadding(prelude: string): [string, string, string] {
  let start = 0;
  for (;;) {
    while (start < prelude.length && SPACE.test(prelude[start])) start++;
    if (prelude.startsWith("/*", start)) {
      start = skipOpaque(prelude, start) ?? prelude.length;
      continue;
    }
    break;
  }
  let end = prelude.length;
  while (end > start && SPACE.test(prelude[end - 1])) end--;
  return [
    prelude.slice(0, start),
    prelude.slice(start, end),
    prelude.slice(end),
  ];
}

// at-rule の名前。"@media (x)" の media、"@-webkit-keyframes f" の -webkit-keyframes を取る。
// "@ x" には当たらない
const AT_RULE_NAME = /^@([-\w]+)/;

function atRuleName(core: string): string {
  return (AT_RULE_NAME.exec(core)?.[1] ?? "").toLowerCase();
}

export function scopeCss(css: string, scope: string): string {
  let out = "";
  let i = 0;
  while (i < css.length) {
    const stop = findTopLevel(css, i, "{};");
    if (stop < 0) {
      out += css.slice(i);
      break;
    }
    const prelude = css.slice(i, stop);
    if (css[stop] !== "{") {
      // 文の at-rule (@import …; / @layer a, b;) と、余った } や ; はそのまま
      out += css.slice(i, stop + 1);
      i = stop + 1;
      continue;
    }
    const close = matchBrace(css, stop);
    if (close < 0) {
      // 閉じていないブロックは書き換えずに残りを全部出す。落とすと本文の見た目が消える
      out += css.slice(i);
      break;
    }
    const [lead, core, trail] = splitPadding(prelude);
    const inner = css.slice(stop + 1, close);
    if (core.startsWith("@")) {
      // @font-face / @keyframes / @page などは中が規則ではないので触らない
      const body = RECURSE_AT_RULES.has(atRuleName(core))
        ? scopeCss(inner, scope)
        : inner;
      out += `${prelude}{${body}}`;
    } else {
      // 宣言ブロックは入れ子の & ごとそのまま。親が閉じ込まれていれば & も中に留まる
      out += `${lead}${scopeSelectorList(core, scope)}${trail}{${inner}}`;
    }
    i = close + 1;
  }
  return out;
}

// 最上位の , で分ける。() [] と文字列の中の , は区切りではない
function splitTopLevelCommas(list: string): string[] {
  const parts: string[] = [];
  let from = 0;
  for (;;) {
    const comma = findTopLevel(list, from, ",");
    if (comma < 0) {
      parts.push(list.slice(from));
      return parts;
    }
    parts.push(list.slice(from, comma));
    from = comma + 1;
  }
}

// 識別子の 1 文字。"a" "-" "_" "日" に当たり、"." ":" " " には当たらない
const IDENT_CHAR = /[-\w\u0080-￿]/;

// from から識別子 (エスケープ込み) を読み、その直後の位置を返す
function readIdent(s: string, from: number): number {
  let i = from;
  while (i < s.length) {
    if (s[i] === "\\") i += PAIR;
    else if (IDENT_CHAR.test(s[i])) i++;
    else break;
  }
  return Math.min(i, s.length);
}

// 入れ物に置き換える型の頭。"html" ":root" "BODY" に当たり、"#html" "div" には当たらない。
// :root は擬似クラスだが、文書の根を指すので html と同じに扱う
const ROOT_TYPE = /^(?::root|html|body)/i;

function readRootType(s: string, i: number): number | null {
  const m = ROOT_TYPE.exec(s.slice(i));
  if (!m) return null;
  const end = i + m[0].length;
  // bodyguard や :root-x のような続きのある名前は別物
  if (end < s.length && (IDENT_CHAR.test(s[end]) || s[end] === "\\"))
    return null;
  return end;
}

// from から修飾 (.cls #id [attr] :pseudo(…)) の並びを読み、その直後の位置を返す
function readModifiers(s: string, from: number): number {
  let i = from;
  while (i < s.length) {
    const c = s[i];
    if (c === "." || c === "#") {
      i = readIdent(s, i + 1);
    } else if (c === "[") {
      const close = findTopLevel(s, i + 1, "]");
      i = close < 0 ? s.length : close + 1;
    } else if (c === ":") {
      i = readIdent(s, s[i + 1] === ":" ? i + PAIR : i + 1);
      if (s[i] === "(") {
        const close = findTopLevel(s, i + 1, ")");
        i = close < 0 ? s.length : close + 1;
      }
    } else {
      break;
    }
  }
  return i;
}

// 頭の結合子と続く空白。"> body" の "> " に当たり、"body" には当たらない
const COMBINATOR = /^[>+~]\s*/;

// 先頭の :root / html / body の複合を続く限り剥がし、付いていた修飾を scope に付け直す。
// :is() / :where() の中までは見ない (spec の「漏れうる」)。外側に前置するだけ
function scopeSelector(selector: string, scope: string): string {
  let mods = "";
  let rest = selector;
  let stripped = false;
  for (;;) {
    const typeEnd = readRootType(rest, 0);
    if (typeEnd === null) break;
    const modEnd = readModifiers(rest, typeEnd);
    mods += rest.slice(typeEnd, modEnd);
    stripped = true;
    rest = rest.slice(modEnd).trimStart();
    // html > body のように剥がす型同士をつなぐ結合子は一緒に捨てる
    const next = COMBINATOR.exec(rest);
    if (next && readRootType(rest, next[0].length) !== null) {
      rest = rest.slice(next[0].length);
    }
  }
  if (!stripped) return `${scope} ${selector}`;
  return rest ? `${scope}${mods} ${rest}` : `${scope}${mods}`;
}

export function scopeSelectorList(list: string, scope: string): string {
  return splitTopLevelCommas(list)
    .map((s) => scopeSelector(s.trim(), scope))
    .join(", ");
}
