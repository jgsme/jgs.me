import React from "react";

// /on-this-day の 3D ビューへの入口。旧 MMDD 記事 (4桁題) と周年日記の日ページ
// の両方に置くので、見た目ごとここに寄せる。hover で warp.gif が透ける。
export const WarpButton = () => {
  return (
    <div className="mt-12 flex justify-center">
      <a
        href="/on-this-day"
        className="group relative inline-flex items-center justify-center px-16 py-8 font-bold text-white transition-all duration-300 bg-neutral-900 rounded-full overflow-hidden hover:scale-105 active:scale-95"
      >
        <div className="absolute inset-0 w-full h-full bg-[url('/warp.gif')] bg-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <span className="relative z-10 text-5xl">WARP</span>
      </a>
    </div>
  );
};
