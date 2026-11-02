import type { PageContextClient } from "vike/types";
import { hardNavigateIfLeavingHtmlArticle } from "@/utils/htmlNavigation";

// HTML article から出る遷移はページを丸ごと読み込む。Vike は離れる側の
// ページの hook を、行き先の pageContext (urlOriginal は行き先の URL) で呼ぶ。
// 出るときは返る Promise が読み込みまで resolve しないので、Vike はクライアントで描かない。
export const onPageTransitionStart = (pageContext: PageContextClient) =>
  hardNavigateIfLeavingHtmlArticle(document, location, pageContext.urlOriginal);
