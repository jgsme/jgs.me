import type { PageContext } from "vike/types";

export default (pageContext: PageContext) =>
  pageContext.is404 ? "ページが見つかりません" : "エラーが発生しました";
