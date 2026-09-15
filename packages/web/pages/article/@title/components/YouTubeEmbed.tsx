import React from "react";

export const YouTubeEmbed: React.FC<{
  videoId: string;
  className?: string;
}> = ({ videoId, className }) => (
  <iframe
    className={className}
    src={`https://www.youtube.com/embed/${videoId}`}
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowFullScreen
  />
);
