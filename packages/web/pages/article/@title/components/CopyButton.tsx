import React from "react";
import { useState } from "react";

export const CopyButton: React.FC<{ articleId: number | null }> = ({
  articleId,
}) => {
  const [copied, setCopied] = useState(false);

  if (!articleId) return null;

  const handleCopy = async () => {
    const url = `${window.location.origin}/a/${articleId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="text-sm border border-solid border-gray-300 px-2 rounded cursor-pointer"
    >
      {copied ? "Copied!" : "Copy Share URL"}
    </button>
  );
};
