import type { PageContextServer } from "vike/types";
import { htmlArticleHeaders } from "@/utils/htmlArticle";

// dev は Vite の HMR が ws: を使うので付けない。cache middleware は
// c.res.clone() を焼くので、キャッシュから返る応答にも付く。
export default (pageContext: PageContextServer) =>
  import.meta.env.DEV ? {} : htmlArticleHeaders(pageContext.data);
