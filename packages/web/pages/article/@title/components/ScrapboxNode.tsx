import type React from "react";
import type { Node as NodeType } from "@progfay/scrapbox-parser";

export const ScrapboxNode: React.FC<{ node: NodeType }> = ({ node }) => {
  switch (node.type) {
    case "plain":
      return <>{node.text}</>;

    case "link":
      if (node.pathType === "relative") {
        return (
          <a
            href={`/pages/${encodeURIComponent(node.href)}`}
            className="text-blue-600 hover:underline"
          >
            {node.href}
          </a>
        );
      }
      return (
        <a
          href={node.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          {node.content || node.href}
        </a>
      );

    case "hashTag":
      return (
        <a
          href={`/pages/${encodeURIComponent(node.href)}`}
          className="text-blue-600 hover:underline"
        >
          #{node.href}
        </a>
      );

    case "image":
      return (
        <img
          src={node.src}
          alt=""
          className="max-w-full h-auto rounded my-2"
          loading="lazy"
        />
      );

    case "decoration": {
      const classes: string[] = [];
      if (node.decos.includes("*-1")) classes.push("text-xl font-bold");
      if (node.decos.includes("*-2")) classes.push("text-2xl font-bold");
      if (node.decos.includes("*-3")) classes.push("text-3xl font-bold");
      if (node.decos.some((d) => d === "/")) classes.push("italic");
      if (node.decos.some((d) => d === "-")) classes.push("line-through");

      return (
        <span className={classes.join(" ")}>
          {node.nodes.map((n, i) => (
            <ScrapboxNode key={i} node={n} />
          ))}
        </span>
      );
    }

    case "code":
      return (
        <code className="bg-neutral-100 px-1 py-0.5 rounded text-sm font-mono">
          {node.text}
        </code>
      );

    case "icon":
      return (
        <img
          src={`https://scrapbox.io/api/pages/jigsaw/${encodeURIComponent(
            node.path
          )}/icon`}
          alt={node.path}
          className="inline w-6 h-6 rounded"
        />
      );

    case "quote":
      return (
        <blockquote className="bg-black/1 border-l-4 border-gray-200 pl-1 py-0.5">
          {node.nodes.map((n, i) => (
            <ScrapboxNode key={i} node={n} />
          ))}
        </blockquote>
      );

    default:
      return null;
  }
};
