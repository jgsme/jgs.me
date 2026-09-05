import React from "react";
import { BouncingCode } from "./BouncingCode";

export const NotFound = () => {
  return (
    <main className="relative min-h-[calc(100svh-var(--spacing-header))] w-full overflow-hidden bg-brand text-paper">
      <BouncingCode />

      <div className="relative z-[2] mx-auto max-w-content px-4 pt-32 pb-32 sm:pt-48">
        <h1 className="mb-4 text-6xl leading-[1.4] font-bold text-center">
          NOT FOUND
        </h1>

        <div className="flex min-h-12 flex-wrap justify-center items-center gap-3">
          <a
            href="/random"
            style={{ transition: "transform 0.4s, color 0.3s" }}
            className="group relative inline-flex h-12 items-center overflow-hidden rounded-full bg-paper px-6 font-bold text-brand no-underline hover:-translate-y-[2px] hover:text-white"
          >
            <span className="absolute inset-0 bg-[url('/warp.gif')] bg-cover opacity-0 transition-opacity duration-[350ms] group-hover:opacity-90" />
            <span className="relative z-[2]">WARP</span>
          </a>
          <a
            href="/"
            className="inline-flex h-12 items-center rounded-full border border-paper/45 px-6 text-sm no-underline hover:bg-paper/12"
          >
            TOP
          </a>
        </div>
      </div>
    </main>
  );
};
