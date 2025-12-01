import React from "react";
import "./index.css";

export const Layout: React.FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <>
      <div className="w-full bg-[#82221c] h-[4rem] py-[8px]">
        <a href="/" className="w-[4rem] h-[4rem]">
          <img src="/mark.svg" className="w-full h-full" />
        </a>
      </div>
      {children}
    </>
  );
};
