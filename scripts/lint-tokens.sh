#!/usr/bin/env bash
# design token から外れた書き方を検出する。
# theme が形骸化するのは「1 箇所だけ arbitrary で書く」の積み重ねなので、
# 機械で止める。封じたパレットは theme.css 側でも initial にしてあるが、
# あちらは「クラスが生成されない」だけで書いた本人には見えにくい。
set -uo pipefail

target="packages/web/pages"
status=0

# 封じたパレット。slate は on-this-day のグローブ UI 専用なので除外する。
if grep -rnE '\b(bg|text|border|ring|divide|fill)-(gray|zinc|stone)-[0-9]' "$target"; then
  echo "!! gray / zinc / stone は使わない。役割名のトークン (fg-muted / border など) を使う"
  status=1
fi

# 生の色。#82221c と #efefef は brand / paper に、それ以外は役割を決めてから足す。
if grep -rnE '\b(bg|text|border|ring|divide|fill)-\[#[0-9a-fA-F]{3,8}\]' "$target"; then
  echo "!! 色を arbitrary value で書かない。packages/theme にトークンを足す"
  status=1
fi

# 共有されているサイズ。1 箇所しか使わない値は arbitrary のままでよい。
if grep -rnE 'max-w-\[600px\]|pb-\[200px\]|h-\[300px\]|[hw]-\[4rem\]|100vh-64px|100svh-4rem' "$target"; then
  echo "!! 共有サイズは token を使う (max-w-content / pb-page-end / h-hero / h-header)"
  status=1
fi

exit $status
