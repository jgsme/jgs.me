#!/usr/bin/env bash
# design token から外れた書き方を検出する。
# theme が形骸化するのは「1 箇所だけ arbitrary で書く」の積み重ねなので、機械で止める。
# theme.css 側の initial は「クラスが生成されない」だけで書いた本人には見えにくいので、
# 書いた時点で落ちるこちらが要る。
set -uo pipefail

# repo のどこから呼ばれても同じ場所を見る。
cd "$(git rev-parse --show-toplevel)" || exit 1

# Tailwind と laque を使っているパッケージ。増えたらここに足す。
# packages/og と packages/home は Tailwind を使っていないので対象外。
targets=(packages/web packages/img/pages)
# target が消えたら黙って通すのではなく落とす。壊れた検査は無いのと同じ。
for t in "${targets[@]}"; do
  if [ ! -d "$t" ]; then
    echo "!! 検査対象が無い: $t"
    exit 1
  fi
done

ex=(--exclude-dir=dist --exclude-dir=node_modules --exclude-dir=.wrangler)
status=0

# 封じたパレット。neutral はトークンの実体だが、直接書くと役割名を迂回できるので同じく弾く。
# slate は on-this-day のグローブ UI 専用なので除外する。
if grep -rnE "${ex[@]}" '(^|[^a-z-])(bg|text|border|ring|divide|fill|stroke|outline|shadow|decoration|placeholder|caret|accent|from|via|to)-(gray|zinc|stone|neutral)-[0-9]' "${targets[@]}"; then
  echo "!! gray / zinc / stone / neutral を直接書かない。役割名のトークン (fg-muted / border など) を使う"
  status=1
fi

# 生の色。hex だけでなく rgb / hsl / oklch / color-mix も弾く。
if grep -rnE "${ex[@]}" '(bg|text|border|ring|divide|fill|stroke|outline|shadow|decoration|placeholder|caret|accent|from|via|to)-\[(#[0-9a-fA-F]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color-mix)\()' "${targets[@]}"; then
  echo "!! 色を arbitrary value で書かない。laque にトークンを足す"
  status=1
fi

# インライン style の生 hex。JSX の style={{ color: "#82221c" }} を拾う。
# 値の側で除外するのは ; だけ。以前は " も除外していて、Prettier が揃える
# ダブルクォートの JSX (まさに拾いたい形) だけがすり抜けていた。
if grep -rnE "${ex[@]}" '(color|background|border|fill|stroke)[^:]*:[^;]*#[0-9a-fA-F]{3,8}' "${targets[@]}" --include='*.tsx' --include='*.ts' --include='*.css'; then
  echo "!! style や CSS に色を直書きしない。laque にトークンを足す"
  status=1
fi

# spacing スケールを消費する utility の接頭辞。下の 2 つのチェックが共有する。
size_prefix='m|mt|mb|ml|mr|mx|my|ms|me|p|pt|pb|pl|pr|px|py|ps|pe|gap|gap-x|gap-y|space-x|space-y|scroll-m|scroll-mt|scroll-mb|scroll-ml|scroll-mr|scroll-mx|scroll-my|scroll-p|scroll-pt|scroll-pb|scroll-pl|scroll-pr|scroll-px|scroll-py|w|h|size|min-w|min-h|max-w|max-h|basis|indent|inset|inset-x|inset-y|top|bottom|left|right|start|end'

# 余白と寸法を arbitrary value で書かない。語彙外の値はクラス自体が生成されないが、
# arbitrary value は生成されてしまうので、こちらは grep で止める。
# 語彙に無い値が要るなら、その場で [] で書かずに語彙を見直す。
# 先頭の -? は負の margin (-mt-[13px]) を拾うため。これが無いと記法ひとつで素通りする。
# translate は spacing 由来だが 1px 単位の微調整 (-translate-y-[2px]) に使うので対象外。
# line-height / duration / z-index / letter-spacing も別の体系なので触らない。
if grep -rnE "${ex[@]}" "(^|[^a-z0-9])-?(${size_prefix})-\[[0-9]" "${targets[@]}"; then
  echo "!! 余白と寸法を arbitrary value で書かない。laque の語彙から選ぶ"
  status=1
fi

# 語彙外の数値。--spacing: initial で語彙外はクラスが生成されないが、生成されないだけで
# build も test も通ってしまい、本番で余白だけが消える。書いた時点で落とす。
# 分数 (w-1/3) と非数値 (h-full / max-w-none) は抽出の時点で外れる。
vocab='0|1|2|3|4|6|8|12|16|24|32|48|64|96|128|192|256'
if grep -rnoE "${ex[@]}" "(^|[^a-z0-9-])-?(${size_prefix})-[0-9]+(\.[0-9]+)?([^0-9/.]|$)" "${targets[@]}" \
  | grep -vE -- "-(${vocab})([^0-9/.]?)$"; then
  echo "!! 語彙に無いサイズを書かない。laque の語彙 (0 1 2 3 4 6 8 12 16 24 32 48 64 96 128 192 256) から選ぶ"
  status=1
fi

# 文字サイズ。font-size は spacing とは別の体系 (laque の 2xs〜6xl) で、
# 語彙外の text-7xl 以上は --text-*: initial でクラスが生成されない。
# 余白と同じく、build も test も通ったまま本番で文字だけが元の大きさに戻るので、書いた時点で落とす。
# variant 付き (md:text-[…] / sm:hover:text-[…]) も拾うので、左は英数字と - 以外を境にする。
# 色の arbitrary value (text-[#…]) は上の色の検査とも重なるが、重なっていて困らない。
# BouncingCode.tsx の 404 の演出は画面幅に追従する大きさ (clamp) で token にならないので、
# そのファイルだけを名指しで外す。ディレクトリごと外すと別のファイルの素通りになる。
if grep -rnE "${ex[@]}" "(^|[^a-zA-Z0-9-])text-\\[" "${targets[@]}" \
  | grep -vE '^packages/web/pages/_error/components/BouncingCode\.tsx:'; then
  echo "!! 文字サイズを arbitrary value で書かない。laque の語彙 (2xs xs sm base lg xl 2xl 3xl 4xl 5xl 6xl) から選ぶ"
  status=1
fi

# 語彙外の段。text-7xl 以上は生成されないので、書いても効かない。
if grep -rnE "${ex[@]}" '(^|[^a-zA-Z0-9-])text-(7|8|9)xl([^a-zA-Z0-9-]|$)' "${targets[@]}"; then
  echo "!! 語彙に無い文字サイズを書かない。laque の語彙 (2xs xs sm base lg xl 2xl 3xl 4xl 5xl 6xl) から選ぶ"
  status=1
fi

# text-deco-* は記事本文の強調 (deco.ts) 専用で、UI の文字サイズとは別の体系。
# UI に紛れ込むと、本文だけ大きくする意図の段が UI の大きさを決めてしまう。
# class の文字列は deco.ts だけが持ち、ほかの component は decoClassName 経由で受け取る。
# 文字列を含んでよいのは deco.ts とその test (ScrapboxBlock.test.tsx 含む) だけ。
if grep -rnE "${ex[@]}" '(^|[^a-zA-Z0-9-])text-deco-' "${targets[@]}" \
  | grep -vE '^packages/web/pages/article/@title/components/(deco\.ts|deco\.test\.ts|ScrapboxBlock\.test\.tsx):'; then
  echo "!! text-deco-* は記事本文の強調だけに使う。UI では UI の語彙を使う"
  status=1
fi

exit $status
