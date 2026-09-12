import React from "react";
import "./index.css";
import { SearchForm } from "./components/SearchForm";

export const Layout = ({ children }: React.PropsWithChildren) => {
  return (
    <>
      <div className="w-full bg-brand h-header py-2">
        <a href="/" className="w-header h-header">
          <img src="/mark.svg" className="w-full h-full" />
        </a>
      </div>
      {/* 各ページの main と同じ幅と余白。ページをまたいで検索窓の位置が動かない。 */}
      <div className="max-w-content mx-auto px-4">
        <SearchForm />
      </div>
      {children}
    </>
  );
};
