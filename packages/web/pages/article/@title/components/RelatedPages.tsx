import React from "react";
import { PageTileGrid } from "./PageTileGrid";

export const RelatedPages: React.FC<{
  related: { title: string; image: string | null }[];
}> = ({ related }) => (
  <PageTileGrid heading="似てるかもしれんページ" pages={related} />
);
