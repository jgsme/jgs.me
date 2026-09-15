import React from "react";
import type { Block } from "@progfay/scrapbox-parser";
import { quoteClassName } from "./quote";
import { ScrapboxNode } from "./ScrapboxNode";

/**
 * 連続する引用行の塊を 1 つの blockquote で出す。kind が quote の clip でだけ使う。
 *
 * 行は改行でつなぐ。行ごとに blockquote を分けると、大きさも引用符も行ごとに
 * 付いてしまう。大きさは塊の合計の長さで決め、引用符は塊の最初と最後に 1 組だけ出る
 * (quote-marks は blockquote の ::before / ::after)。
 */
export const QuoteRun: React.FC<{ lines: Block[]; indent: number }> = ({
  lines,
  indent,
}) => {
  const quotes = lines.flatMap((line) =>
    line.type === "line"
      ? line.nodes.filter((node) => node.type === "quote")
      : [],
  );
  return (
    <div
      data-quote
      className="leading-relaxed"
      style={{ paddingLeft: `${indent * 1.5}rem` }}
    >
      <blockquote
        className={quoteClassName(quotes, { emphasize: true, indent })}
      >
        {lines.map((line, i) => (
          <React.Fragment key={i}>
            {i > 0 && <br />}
            {line.type === "line" &&
              line.nodes.map((node, j) =>
                // quote node の中身だけを出す。quote node ごと ScrapboxNode に渡すと
                // 行ごとに blockquote が入れ子になる。
                node.type === "quote" ? (
                  node.nodes.map((child, k) => (
                    <ScrapboxNode
                      key={`${j}-${k}`}
                      node={child}
                      indent={indent}
                      emphasizeQuote
                    />
                  ))
                ) : (
                  <ScrapboxNode
                    key={j}
                    node={node}
                    indent={indent}
                    emphasizeQuote
                  />
                ),
              )}
          </React.Fragment>
        ))}
      </blockquote>
    </div>
  );
};
