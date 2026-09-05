import { Config } from "vike/types";
import vikeReact from "vike-react/config";
import { Layout } from "./Layout";

export const config = {
  extends: [vikeReact],
  Layout,
  // 個別ページは +data で画像ごとの題に差し替える。ここは 404 などの控え。
  title: "jgs.me",
  lang: "ja",
  // このページに対話的な要素は一つも無い。既定のままだと React の実行時が
  // まるごとクライアントに載る (283KB)。切ると script タグが 1 つも出なくなり、
  // 配るのは HTML と CSS 6KB だけになる。unfurl の bot には効かないが、
  // リンクを踏んだ人には効く。
  //
  // onRenderClient を null にするのは vike の「継承した config を消す」仕組みで、
  // +config.ts の中でだけ効く (vike 0.4.263 の
  // pluginVirtualFiles/getConfigValueSourcesRelevant.js のコメントが根拠)。
  // Config の型が null を表現していないので ts-expect-error が要る。
  // 将来 vike が型を直したらここが「不要な expect-error」で落ちるので気づける。
  clientRouting: false,
  // @ts-expect-error vike の型が null (継承の打ち消し) を表現していない
  onRenderClient: null,
} satisfies Config;
