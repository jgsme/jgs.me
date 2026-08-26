import React from "react";
import { BouncingCode } from "./BouncingCode";

export const NotFound = () => {
  return (
    <main className="relative min-h-[calc(100svh-4rem)] w-full overflow-hidden bg-[#82221c] text-[#efefef]">
      <BouncingCode />

      <div className="relative z-[2] mx-auto max-w-[600px] px-4 pt-[120px] pb-[120px] sm:pt-[180px]">
        <h1 className="mb-4 text-[1.75rem] leading-[1.4] font-bold">
          このページは行き先を失いました
        </h1>
        <p className="mb-8 max-w-[42ch] leading-[1.9] text-pretty opacity-85">
          URL
          は残っていますが、中身はありません。眺めていても戻ってこないので、別の記事へ移りましょう。
        </p>

        <div className="flex min-h-[52px] flex-wrap items-center gap-3">
          {/* 行き先は /random に任せる。エラーページで DB を引くと、
              引けなかったときに 404 が 500 に化ける。 */}
          <a
            href="/random"
            style={{ transition: "transform 0.4s, color 0.3s" }}
            className="group relative inline-flex h-[52px] items-center overflow-hidden rounded-full bg-[#efefef] px-[26px] font-bold text-[#82221c] no-underline hover:-translate-y-[2px] hover:text-white"
          >
            <span className="absolute inset-0 bg-[url('/warp.gif')] bg-cover opacity-0 transition-opacity duration-[350ms] group-hover:opacity-90" />
            <span className="relative z-[2]">適当な記事へ飛ぶ</span>
          </a>
          <a
            href="/"
            className="inline-flex h-[52px] items-center rounded-full border border-[#efefef]/45 px-[22px] text-sm no-underline hover:bg-[#efefef]/12"
          >
            トップへ戻る
          </a>
        </div>
      </div>
    </main>
  );
};
