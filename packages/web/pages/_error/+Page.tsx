import React from "react";
import { usePageContext } from "vike-react/usePageContext";
import { NotFound } from "./components/NotFound";

const Page = () => {
  const { is404 } = usePageContext();

  if (is404) return <NotFound />;

  return (
    <main className="max-w-content mx-auto px-4 pt-8 pb-page-end">
      <h1 className="font-bold text-2xl mb-4">ERROR</h1>
      <a href="/" className="underline">
        TOP
      </a>
    </main>
  );
};

export default Page;
