import React from "react";
import type { Block as BlockType } from "@progfay/scrapbox-parser";
import { parseCardBlock } from "./card";
import { ScrapboxNode } from "./ScrapboxNode";

export const ScrapboxBlock: React.FC<{ block: BlockType }> = ({ block }) => {
  switch (block.type) {
    case "title":
      return null;

    case "line": {
      if (block.nodes.length === 0) {
        return <div className="h-4" />;
      }
      const hasBlockElement = block.nodes.some((n) => n.type === "quote");
      const Tag = hasBlockElement ? "div" : "p";
      return (
        <Tag
          className="leading-relaxed"
          style={{ paddingLeft: `${block.indent * 1.5}rem` }}
        >
          {block.nodes.map((node, i) => (
            <ScrapboxNode key={i} node={node} />
          ))}
        </Tag>
      );
    }

    case "codeBlock": {
      if (block.fileName === "card") {
        const card = parseCardBlock(block.content);
        if (card) {
          return (
            <figure className="my-4">
              <a
                href={card.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col border border-neutral-300 rounded overflow-hidden hover:bg-neutral-50 sm:flex-row"
              >
                {/* 余白はテキスト側だけに付ける。画像は枠にぴったり付く。
                    狭いときは全幅の 16:9、広いときは正方形のサムネ。
                    sm:self-center が要る — 横並びだと align-self の既定
                    (stretch) が aspect-ratio を上書きして画像が潰れる。 */}
                {card.image && (
                  <img
                    src={card.image}
                    alt=""
                    className="w-full aspect-video shrink-0 object-cover object-center sm:w-40 sm:aspect-square sm:self-center"
                    loading="lazy"
                  />
                )}
                <span className="flex min-w-0 flex-col justify-center gap-1 p-3 sm:px-4">
                  <span className="line-clamp-2 font-bold text-blue-600">
                    {card.title ?? card.url}
                  </span>
                  {card.description && (
                    <span className="line-clamp-2 text-sm text-neutral-600">
                      {card.description}
                    </span>
                  )}
                  {card.siteName && (
                    <span className="text-xs text-neutral-400">
                      {card.siteName}
                    </span>
                  )}
                </span>
              </a>
            </figure>
          );
        }
      }
      return (
        <pre className="bg-neutral-100 p-4 rounded overflow-x-auto my-4">
          <code className="text-sm font-mono">{block.content}</code>
        </pre>
      );
    }

    case "table":
      return (
        <table className="border-collapse my-4 w-full">
          <tbody>
            {block.cells.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className="border border-neutral-300 px-2 py-1">
                    {cell.map((node, k) => (
                      <ScrapboxNode key={k} node={node} />
                    ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );

    default:
      return null;
  }
};
