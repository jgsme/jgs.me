import type { RenderedHtmlArticle } from "@jigsaw/db/html-article";
import { htmlArticleDescription, htmlArticleText } from "@/utils/htmlArticle";
import { SPOILER_NOTICE } from "@/utils/spoiler";

export type HtmlArticleData = {
  ok: true;
  view: "html";
  title: string;
  heading: string;
  pageId: number;
  druckId: number | null;
  render: RenderedHtmlArticle;
  text: string[];
  // spoiler なら SPOILER_NOTICE
  description: string;
  spoiler: boolean;
  fromDate: string | null;
  atUri: string | null;
  related: { title: string; image: string | null }[];
};

export function buildHtmlArticleData(input: {
  title: string;
  pageId: number;
  druckId: number | null;
  spoiler: boolean;
  date: string | null;
  sbBody: string;
  render: RenderedHtmlArticle;
  atUri: string | null;
  related: { title: string; image: string | null }[];
}): HtmlArticleData {
  return {
    ok: true,
    view: "html",
    title: input.title,
    // html 記事は zet ではないので、見出しは題そのまま
    heading: input.title,
    pageId: input.pageId,
    druckId: input.druckId,
    render: input.render,
    text: htmlArticleText(input.sbBody),
    description: input.spoiler
      ? SPOILER_NOTICE
      : htmlArticleDescription(input.sbBody),
    spoiler: input.spoiler,
    fromDate: input.date,
    atUri: input.atUri,
    related: input.related,
  };
}
