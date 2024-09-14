import React from "react";
import "./index.css";

export const Layout: React.FC<React.PropsWithChildren> = ({ children }) => {
  return <div>{children}</div>;
};
