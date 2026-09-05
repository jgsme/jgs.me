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

# トークン化済みの値。接頭辞を問わず「値の語彙」で弾く。
# 以前は max-w-[600px] のような完全一致で見ていたので、h-[64px] や w-[600px] のような
# 同じ値の別表記が素通りしていた (ヘッダー高さの px 表記はまさに今回直した症状)。
# コメント行は除外する。listImage.ts のように srcset の px 計算をコメントで
# 説明していると、実際のクラス指定ではないのに語彙だけ一致してしまうため。
if grep -rnE "${ex[@]}" '\[(600px|200px|300px|4rem|64px)\]' "$target" | grep -vE ':[[:space:]]*//'; then
  echo "!! 共有サイズは token を使う (max-w-content / pb-page-end / h-hero / h-header)"
  status=1
fi

# ヘッダー高さの直書き。calc の中に混ぜても弾く。
if grep -rnE "${ex[@]}" 'calc\(100[sd]?vh *- *(4rem|64px)\)' "$target"; then
  echo "!! ヘッダー高さは var(--spacing-header) を参照する"
  status=1
fi

exit $status
