import type React from "react";
import type { Block as BlockType } from "@progfay/scrapbox-parser";
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

    case "codeBlock":
      return (
        <pre className="bg-neutral-100 p-4 rounded overflow-x-auto my-4">
          <code className="text-sm font-mono">{block.content}</code>
        </pre>
      );

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
