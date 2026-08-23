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
                className="flex flex-col border border-neutral-300 rounded overflow-hidden hover:bg-neutral-50"
              >
                {card.image && (
                  <img
                    src={card.image}
                    alt=""
                    className="w-full h-auto object-cover"
                    loading="lazy"
                  />
                )}
                <span className="block p-4">
                  <span className="block font-bold text-blue-600">
                    {card.title ?? card.url}
                  </span>
                  {card.description && (
                    <span className="block text-sm text-neutral-600 mt-1">
                      {card.description}
                    </span>
                  )}
                  {card.siteName && (
                    <span className="block text-xs text-neutral-400 mt-1">
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
