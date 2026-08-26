import React from "react";
import { usePageContext } from "vike-react/usePageContext";
import { NotFound } from "./components/NotFound";

const Page = () => {
  const { is404 } = usePageContext();

  if (is404) return <NotFound />;

  return (
    <main className="max-w-[600px] mx-auto px-4 pt-8 pb-[200px]">
      <h1 className="font-bold text-[1.5rem] mb-4">ERROR</h1>
      <a href="/" className="underline">
        TOP
      </a>
    </main>
  );
};

export default Page;
