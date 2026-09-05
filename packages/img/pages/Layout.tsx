import "./index.css";
import type { PropsWithChildren } from "react";

// jgs.me 本体のようなヘッダーは置かない。このページは unfurl の着地点で、
// 見に来た人が見たいのは画像そのものだから。
export const Layout = ({ children }: PropsWithChildren) => (
  <main className="max-w-content mx-auto px-4 py-8">{children}</main>
);
