import React from "react";
import { BouncingCode } from "./BouncingCode";

export const NotFound = () => {
  return (
    <main className="relative min-h-[calc(100svh-var(--spacing-header))] w-full overflow-hidden bg-brand text-paper">
      <BouncingCode />

      <div className="relative z-[2] mx-auto max-w-content px-4 pt-[120px] pb-[120px] sm:pt-[180px]">
        <h1 className="mb-4 text-6xl leading-[1.4] font-bold text-center">
          NOT FOUND
        </h1>

        <div className="flex min-h-[52px] flex-wrap justify-center items-center gap-3">
          <a
            href="/random"
            style={{ transition: "transform 0.4s, color 0.3s" }}
            className="group relative inline-flex h-[52px] items-center overflow-hidden rounded-full bg-paper px-[26px] font-bold text-brand no-underline hover:-translate-y-[2px] hover:text-white"
          >
            <span className="absolute inset-0 bg-[url('/warp.gif')] bg-cover opacity-0 transition-opacity duration-[350ms] group-hover:opacity-90" />
            <span className="relative z-[2]">WARP</span>
          </a>
          <a
            href="/"
            className="inline-flex h-[52px] items-center rounded-full border border-paper/45 px-[22px] text-sm no-underline hover:bg-paper/12"
          >
            TOP
          </a>
        </div>
      </div>
    </main>
  );
};
