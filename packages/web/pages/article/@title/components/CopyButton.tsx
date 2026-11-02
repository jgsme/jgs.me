import React from "react";
import { useState } from "react";

// onBrand は赤い帯 (bg-brand) の上に置くときの配色。HTML article の下の帯で使う。
const TONES = {
  default: "border-border px-1 rounded",
  onBrand: "border-white/40 text-paper px-2 rounded-full",
} as const;

export const CopyButton: React.FC<{
  path: string | null;
  tone?: keyof typeof TONES;
}> = ({ path, tone = "default" }) => {
  const [copied, setCopied] = useState(false);

  if (!path) return null;

  const handleCopy = async () => {
    const url = `${window.location.origin}${path}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`text-xs border border-solid cursor-pointer ${TONES[tone]}`}
    >
      {copied ? "Copied!" : "Copy Share URL"}
    </button>
  );
};
