import React from "react";
import "./index.css";
import { usePageContext } from "vike-react/usePageContext";
import { SearchForm } from "./components/SearchForm";
import { TodayLink } from "./components/TodayLink";

export const Layout = ({ children }: React.PropsWithChildren) => {
  const { urlPathname } = usePageContext();
  // 周年日記への導線はトップだけに出す。検索窓と 1 行に並べるので、
  // 出し分けは検索窓を持つこちら側でやる。
  const isTop = urlPathname === "/";

  return (
    <>
      <div className="w-full bg-brand h-header py-2">
        <a href="/" className="w-header h-header">
          <img src="/mark.svg" className="w-full h-full" />
        </a>
      </div>
      {/* 各ページの main と同じ幅と余白。ページをまたいで検索窓の位置が動かない。 */}
      <div className="max-w-content mx-auto px-4">
        <div className="flex gap-4 my-2">
          <div className="grow">
            <SearchForm />
          </div>
          {/* 幅の狭い端末では落とす。128px 固定のこれを並べると検索窓が
              潰れて「検索」ボタンのラベルまで折り返す。周年日記へは
              トップの導線が無くても /on-this-day から辿れる。 */}
          {isTop && (
            <div className="hidden sm:block">
              <TodayLink />
            </div>
          )}
        </div>
      </div>
      {children}
    </>
  );
};
