#!/usr/bin/env bash
# design token から外れた書き方を検出する。
# theme が形骸化するのは「1 箇所だけ arbitrary で書く」の積み重ねなので、機械で止める。
# theme.css 側の initial は「クラスが生成されない」だけで書いた本人には見えにくいので、
# 書いた時点で落ちるこちらが要る。
set -uo pipefail

# repo のどこから呼ばれても同じ場所を見る。
cd "$(git rev-parse --show-toplevel)" || exit 1

target="packages/web"
# target が消えたら黙って通すのではなく落とす。壊れた検査は無いのと同じ。
if [ ! -d "$target" ]; then
  echo "!! 検査対象が無い: $target"
  exit 1
fi

ex=(--exclude-dir=dist --exclude-dir=node_modules --exclude-dir=.wrangler)
status=0

# 封じたパレット。neutral はトークンの実体だが、直接書くと役割名を迂回できるので同じく弾く。
# slate は on-this-day のグローブ UI 専用なので除外する。
if grep -rnE "${ex[@]}" '(^|[^a-z-])(bg|text|border|ring|divide|fill|stroke|outline|shadow|decoration|placeholder|caret|accent|from|via|to)-(gray|zinc|stone|neutral)-[0-9]' "$target"; then
  echo "!! gray / zinc / stone / neutral を直接書かない。役割名のトークン (fg-muted / border など) を使う"
  status=1
fi

# 生の色。hex だけでなく rgb / hsl / oklch / color-mix も弾く。
if grep -rnE "${ex[@]}" '(bg|text|border|ring|divide|fill|stroke|outline|shadow|decoration|placeholder|caret|accent|from|via|to)-\[(#[0-9a-fA-F]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color-mix)\()' "$target"; then
  echo "!! 色を arbitrary value で書かない。packages/theme にトークンを足す"
  status=1
fi

# インライン style の生 hex。JSX の style={{ color: "#82221c" }} を拾う。
if grep -rnE "${ex[@]}" '(color|background|border|fill|stroke)[^:]*:[^;"]*#[0-9a-fA-F]{3,8}' "$target" --include='*.tsx' --include='*.ts' --include='*.css'; then
  echo "!! style や CSS に色を直書きしない。packages/theme にトークンを足す"
  status=1
fi

# 余白と寸法を arbitrary value で書かない。語彙外の値はクラス自体が生成されないが、
# arbitrary value は生成されてしまうので、こちらは grep で止める。
# 語彙に無い値が要るなら、その場で [] で書かずに語彙を見直す。
# 対象は spacing 系の接頭辞だけ。line-height / duration / z-index / transform /
# font-size / letter-spacing は別の体系なので触らない。
if grep -rnE "${ex[@]}" '(^|[^a-z-])(m|mt|mb|ml|mr|mx|my|p|pt|pb|pl|pr|px|py|gap|gap-x|gap-y|space-x|space-y|w|h|size|min-w|min-h|max-w|max-h|inset|inset-x|inset-y|top|bottom|left|right)-\[[0-9]' "$target"; then
  echo "!! 余白と寸法を arbitrary value で書かない。packages/theme の語彙から選ぶ"
  status=1
fi

exit $status
