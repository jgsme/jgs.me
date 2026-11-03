// HTML article の本文は自分で書いた HTML で、<script> を含む。Vike の
// クライアント遷移で描くと innerHTML で入った <script> は動かず、出るときは
// script が足した listener や timer が次のページに残る。なので HTML article
// への出入りはページを丸ごと読み込む。リンクごとに data-vike="false" を
// 付ける方式は、本文の [題] リンクやブラウザの戻る / 進むを拾えないので採らない。

import { HTML_ARTICLE_CLASS } from "@jigsaw/db/html-article";

// code:xhtm の部品を描く入れ物。部品の script も innerHTML で入るので HTML article と同じ扱い。
export const XHTM_HOST_CLASS = "xhtm-host";

const HARD_NAVIGATION_SELECTOR = `.${HTML_ARTICLE_CLASS}, .${XHTM_HOST_CLASS}`;

// assign が効かなかったとき (オフラインなど) に Vike の遷移を返すまでの時間。
export const HARD_NAVIGATION_FALLBACK_MS = 10_000;

// 入るとき: クライアント遷移で描かれようとしている (isHydration === false)。
// URL はもう行き先に変わっているので、呼ぶ側は何も描かずに reload する。
// サーバでは isHydration が無い (undefined) ので false。
export const shouldReloadOnArrival = (pageContext: {
  isHydration?: boolean;
}): boolean => pageContext.isHydration === false;

// 通常の記事: 本文に code:xhtm があり、クライアント遷移で来たら読み込み直す。
export const shouldReloadArticleOnArrival = (
  pageContext: { isHydration?: boolean },
  blocks: ReadonlyArray<{ type: string; fileName?: string }>,
): boolean =>
  shouldReloadOnArrival(pageContext) &&
  blocks.some((b) => b.type === "codeBlock" && b.fileName === "xhtm");

// 出るとき: HTML article / xhtm の部品が描かれたページに居る間に Vike の遷移が始まったら、行き先を
// 丸ごと読み込む。戻る / 進むでは URL がもう行き先なので、同じ URL への
// assign は履歴を足さずに置き換えになる。
// Vike は hook を await したあと古い document の中で描画と pushState を
// 続けるので、resolve しない Promise を返して止める。次のページが一瞬
// 描かれたり、pushState が読み込みとぶつかったりしないように。
// document が fallbackMs 経っても残っていたら (assign が効かなかった)、
// resolve して Vike の遷移に戻し、画面が止まったままにしない。
// 出ないときは undefined を返し、Vike にそのまま任せる。
export const hardNavigateIfLeavingHtmlArticle = (
  doc: Pick<Document, "querySelector">,
  loc: Pick<Location, "assign">,
  urlOriginal: string,
  setTimer: (fn: () => void, ms: number) => unknown = setTimeout,
  fallbackMs: number = HARD_NAVIGATION_FALLBACK_MS,
): Promise<void> | undefined => {
  if (!doc.querySelector(HARD_NAVIGATION_SELECTOR)) return undefined;
  loc.assign(urlOriginal);
  return new Promise<void>((resolve) => {
    setTimer(resolve, fallbackMs);
  });
};
