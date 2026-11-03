import React from "react";
import { useData } from "vike-react/useData";
import { cardImageSources } from "@/utils/listImage";
import type data from "./+data";

const Page = () => {
  const d = useData<Awaited<ReturnType<typeof data>>>();
  const { prev, next } = d.payload.links;

  return (
    <main className="max-w-content mx-auto px-4 pb-48">
      <h1 className="font-bold text-2xl mt-8">druck</h1>
      <ul>
        {d.payload.druck.map((item) => (
          <li key={item.id} className="my-8">
            <a href={item.href}>
              {item.image ? (
                <img
                  {...cardImageSources(item.image)}
                  alt={item.title}
                  className="mb-2 rounded mx-auto h-96 object-contain"
                  loading="lazy"
                />
              ) : (
                <div className="h-96 text-center mx-auto font-bold flex justify-center items-center bg-black/[0.04] mb-2 rounded text-4xl">
                  {item.title}
                </div>
              )}
              <div className="font-bold text-xl">{item.title}</div>
            </a>
          </li>
        ))}
      </ul>

      <div className="flex justify-between mt-24">
        {prev ? (
          <a href={prev} className="block underline">
            前のページ
          </a>
        ) : (
          <div />
        )}
        {next && (
          <a href={next} className="block underline">
            次のページ
          </a>
        )}
      </div>
    </main>
  );
};

export default Page;
