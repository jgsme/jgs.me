import React from "react";
import { useState } from "react";

export const CopyButton: React.FC<{ path: string | null }> = ({ path }) => {
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
      className="text-xs border border-solid border-border px-1 rounded cursor-pointer"
    >
      {copied ? "Copied!" : "Copy Share URL"}
    </button>
  );
};
