import { Config } from "vike/types";
import vikeReact from "vike-react/config";
import vikePhoton from "vike-photon/config";
import { Layout } from "./Layout";

export const config = {
  extends: [vikeReact, vikePhoton],
  Layout,
  title: "I am Electrical machine",
  lang: "ja",
  photon: {
    server: "server/index.ts",
  },
} satisfies Config;
