import React from "react";
import { useData } from "vike-react/useData";
import type data from "./+data";

const Page = () => {
  const d = useData<Awaited<ReturnType<typeof data>>>();
  console.log(d.payload);
  return <div>Works!</div>;
};

export default Page;
