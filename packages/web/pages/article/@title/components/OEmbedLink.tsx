import React from "react";
import { OEmbedView, useOEmbed } from "./OEmbed";

// +data.ts で取れた oEmbed があれば埋め込み、無ければ普通のリンク。
export const OEmbedLink: React.FC<{
  url: string;
  href: string;
  label: string;
}> = ({ url, href, label }) => {
  const embed = useOEmbed(url);
  if (embed) return <OEmbedView embed={embed} />;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-link hover:underline"
    >
      {label}
    </a>
  );
};
