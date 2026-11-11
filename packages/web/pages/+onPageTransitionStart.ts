import type { PageContextClient } from "vike/types";
import {
  hardNavigateIfDraftTransition,
  hardNavigateIfLeavingHtmlArticle,
} from "@/utils/htmlNavigation";

// HTML article から出る遷移と、draft への出入りはページを丸ごと読み込む。
// Vike は離れる側のページの hook を、行き先の pageContext (urlOriginal は行き先の URL) で呼ぶ。
// 出るときは返る Promise が読み込みまで resolve しないので、Vike はクライアントで描かない。
export const onPageTransitionStart = (pageContext: PageContextClient) =>
  hardNavigateIfLeavingHtmlArticle(
    document,
    location,
    pageContext.urlOriginal,
  ) ?? hardNavigateIfDraftTransition(location, pageContext.urlOriginal);
