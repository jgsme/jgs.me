import React from "react";
import "./index.css";

export const Layout = ({ children }: React.PropsWithChildren) => {
  return (
    <>
      <div className="w-full bg-brand h-header py-2">
        <a href="/" className="w-header h-header">
          <img src="/mark.svg" className="w-full h-full" />
        </a>
      </div>
      {children}
    </>
  );
};
