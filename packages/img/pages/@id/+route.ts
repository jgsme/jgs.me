import type { RouteSync } from "vike/types";

// id は内容の sha256。この形でないものは D1 を引くまでもなく無い。
const ID = /^[0-9a-f]{64}$/;

// Route String (`/@id`) だと任意の 1 セグメントに当たってしまい、
// /favicon.ico のような雑多なリクエストまで +data に流れて D1 を引く。
const route: RouteSync = (pageContext) => {
  const id = pageContext.urlPathname.slice(1);
  return ID.test(id) ? { routeParams: { id } } : false;
};

export default route;
