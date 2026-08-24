import React from "react";
import { usePageContext } from "vike-react/usePageContext";

// これが無いと Vike は「エラーページ未定義」の素の HTML を 500 で返す。
// 存在しない URL まで 500 になり、クローラからは一時障害と区別がつかない。
const Page = () => {
  const { is404 } = usePageContext();

  return (
    <main className="max-w-[600px] mx-auto px-4 pt-8 pb-[200px]">
      <h1 className="font-bold text-[1.5rem] mb-4">
        {is404 ? "ページが見つかりません" : "エラーが発生しました"}
      </h1>
      <p className="mb-8">
        {is404
          ? "この URL のページは存在しません。移動したか、消えたかのどちらかです。"
          : "しばらく待ってから、もう一度開いてみてください。"}
      </p>
      <a href="/" className="underline">
        トップへ
      </a>
    </main>
  );
};

export default Page;
