// HTML article の本文は自分で書いた HTML で、<script> を含む。Vike の
// クライアント遷移で描くと innerHTML で入った <script> は動かず、出るときは
// script が足した listener や timer が次のページに残る。なので HTML article
// への出入りはページを丸ごと読み込む。リンクごとに data-vike="false" を
// 付ける方式は、本文の [題] リンクやブラウザの戻る / 進むを拾えないので採らない。

import { HTML_ARTICLE_CLASS } from "@jigsaw/db/html-article";
import { isDraftPath } from "@jigsaw/db/draft";

const HTML_ARTICLE_SELECTOR = `.${HTML_ARTICLE_CLASS}`;

// assign が効かなかったとき (オフラインなど) に Vike の遷移を返すまでの時間。
export const HARD_NAVIGATION_FALLBACK_MS = 10_000;

// 入るとき: クライアント遷移で描かれようとしている (isHydration === false)。
// URL はもう行き先に変わっているので、呼ぶ側は何も描かずに reload する。
// サーバでは isHydration が無い (undefined) ので false。
export const shouldReloadOnArrival = (pageContext: {
  isHydration?: boolean;
}): boolean => pageContext.isHydration === false;

// 出るとき: HTML article に居る間に Vike の遷移が始まったら、行き先を
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
  if (!doc.querySelector(HTML_ARTICLE_SELECTOR)) return undefined;
  return holdForHardNavigation(loc, urlOriginal, setTimer, fallbackMs);
};

// draft への出入りもページを丸ごと読み込む。+Head は最初の document にしか
// 描かれないので、普通のページから始めたセッションでは gtag がもう読み込み済みで、
// クライアント遷移で draft に入ると鍵入りの URL が Google に渡る。
// 出るときは読み込み直しで gtag が戻る。戻る / 進むで出る場合は location が
// すでに行き先なので検知できないが、その場合は鍵入りの URL が行き先側に残らない。
export const hardNavigateIfDraftTransition = (
  loc: Pick<Location, "assign" | "pathname">,
  urlOriginal: string,
  setTimer: (fn: () => void, ms: number) => unknown = setTimeout,
  fallbackMs: number = HARD_NAVIGATION_FALLBACK_MS,
): Promise<void> | undefined => {
  const destination = new URL(urlOriginal, "http://localhost").pathname;
  if (!isDraftPath(destination) && !isDraftPath(loc.pathname)) {
    return undefined;
  }
  return holdForHardNavigation(loc, urlOriginal, setTimer, fallbackMs);
};

const holdForHardNavigation = (
  loc: Pick<Location, "assign">,
  urlOriginal: string,
  setTimer: (fn: () => void, ms: number) => unknown,
  fallbackMs: number,
): Promise<void> => {
  loc.assign(urlOriginal);
  return new Promise<void>((resolve) => {
    setTimer(resolve, fallbackMs);
  });
};
