import React, { useState } from "react";

// ネタバレの page は押すまで本文を描かない。SSR でも閉じたまま出すので、
// HTML の e-content は空になり、mf2 を読む側にも本文が渡らない。
export const SpoilerGate: React.FC<{
  spoiler: boolean;
  children: React.ReactNode;
}> = ({ spoiler, children }) => {
  const [revealed, setRevealed] = useState(false);

  if (!spoiler || revealed) return <>{children}</>;

  return (
    <div className="border border-solid border-border rounded px-4 py-6 flex flex-col items-center gap-3">
      <p className="text-fg-subtle text-sm">ネタバレを含む</p>
      <button
        type="button"
        onClick={() => setRevealed(true)}
        className="text-sm border border-solid border-border px-3 py-1 rounded cursor-pointer"
      >
        表示する
      </button>
    </div>
  );
};
