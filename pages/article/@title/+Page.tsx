import React from "react";
import { useData } from "vike-react/useData";
import type data from "./+data";
import type { BlockType, NodeType } from "@progfay/scrapbox-parser";

type Data = Awaited<ReturnType<typeof data>>;

const Node: React.FC<{ node: NodeType }> = ({ node }) => {
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
            <Node key={i} node={n} />
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
          src={`https://scrapbox.io/api/pages/jigsaw/${encodeURIComponent(node.path)}/icon`}
          alt={node.path}
          className="inline w-6 h-6 rounded"
        />
      );

    case "quote":
      return (
        <span className="text-neutral-500 italic">&gt; {node.nodes.map((n, i) => <Node key={i} node={n} />)}</span>
      );

    default:
      return null;
  }
};

const Block: React.FC<{ block: BlockType }> = ({ block }) => {
  switch (block.type) {
    case "title":
      return null;

    case "line":
      if (block.nodes.length === 0) {
        return <div className="h-4" />;
      }
      return (
        <p
          className="leading-relaxed"
          style={{ paddingLeft: `${block.indent * 1.5}rem` }}
        >
          {block.nodes.map((node, i) => (
            <Node key={i} node={node} />
          ))}
        </p>
      );

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
                      <Node key={k} node={node} />
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

const CopyButton: React.FC<{ articleId: number | null }> = ({ articleId }) => {
  const [copied, setCopied] = React.useState(false);

  if (!articleId) return null;

  const handleCopy = async () => {
    const url = `${window.location.origin}/a/${articleId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="text-sm text-blue-600 hover:underline"
    >
      {copied ? "Copied!" : "Copy Share URL"}
    </button>
  );
};

const Page = () => {
  const d = useData<Data>();

  if (!d.ok) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">{d.title}</h1>
        <p className="text-neutral-500">Page not found</p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">{d.title}</h1>
        <CopyButton articleId={d.articleId} />
      </div>
      <article className="space-y-1">
        {d.blocks.map((block, i) => (
          <Block key={i} block={block} />
        ))}
      </article>
    </main>
  );
};

export default Page;
