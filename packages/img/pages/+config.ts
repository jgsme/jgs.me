import { Config } from "vike/types";
import vikeReact from "vike-react/config";
import { Layout } from "./Layout";

export const config = {
  extends: [vikeReact],
  Layout,
  // 個別ページは +data で画像ごとの題に差し替える。ここは 404 などの控え。
  title: "jgs.me",
  lang: "ja",
} satisfies Config;
