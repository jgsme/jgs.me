// HTML article の本文は自分で書いた HTML で、<script> を含む。Vike の
// クライアント遷移で描くと innerHTML で入った <script> は動かず、出るときは
// script が足した listener や timer が次のページに残る。なので HTML article
// への出入りはページを丸ごと読み込む。リンクごとに data-vike="false" を
// 付ける方式は、本文の [題] リンクやブラウザの戻る / 進むを拾えないので採らない。

// 本文の入れ物。ingest が描く HTML の一番外側に付く class。
const HTML_ARTICLE_SELECTOR = ".jgs-html-article";

// 入るとき: クライアント遷移で描かれようとしている (isHydration === false)。
// URL はもう行き先に変わっているので、呼ぶ側は何も描かずに reload する。
// サーバでは isHydration が無い (undefined) ので false。
export const shouldReloadOnArrival = (pageContext: {
  isHydration?: boolean;
}): boolean => pageContext.isHydration === false;

// 出るとき: HTML article に居る間に Vike の遷移が始まったら、行き先を
// 丸ごと読み込む。戻る / 進むでは URL がもう行き先なので、同じ URL への
// assign は履歴を足さずに置き換えになる。
export const hardNavigateIfLeavingHtmlArticle = (
  doc: Pick<Document, "querySelector">,
  loc: Pick<Location, "assign">,
  urlOriginal: string,
): boolean => {
  if (!doc.querySelector(HTML_ARTICLE_SELECTOR)) return false;
  loc.assign(urlOriginal);
  return true;
};
