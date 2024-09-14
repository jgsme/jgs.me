import { Config } from "vike/types";
import vikeReact from "vike-react/config";
import { Layout } from "./Layout";

export const config = {
  extends: vikeReact,
  Layout,
  title: "I am Electrical machine",
} satisfies Config;
