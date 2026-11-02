import React from "react";
import { PageTileGrid, type TileTone } from "./PageTileGrid";

export const RelatedPages: React.FC<{
  related: { title: string; image: string | null }[];
  tone?: TileTone;
}> = ({ related, tone }) => (
  <PageTileGrid heading="似てるかもしれんページ" pages={related} tone={tone} />
);
