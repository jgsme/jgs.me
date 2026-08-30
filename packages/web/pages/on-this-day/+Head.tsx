import React from "react";

// title と description は +data.ts の useConfig で設定する。
// +Head.tsx の内容は子ルートに累積して打ち消せないため、ここに直接書くと
// /on-this-day/MMDD で title が二重になる。
export function Head() {
  return <></>;
}
