import type { PageContextServer } from "vike/types";
import type { Bindings } from "@/server";
import { extractSnippet } from "@/utils/extractSnippet";

type Context = PageContextServer & {
  env: Bindings;
};

type SearchResult = {
  title: string;
  snippet: string;
  score: number;
};

const extractTitle = (content: Array<{ text: string }>): string | null => {
  const text = content[0]?.text ?? "";
  try {
    const parsed = JSON.parse(text);
    if (parsed.title) return parsed.title;
  } catch {
    const match = text.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (match) {
      return match[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }
  }
  return null;
};

const extractSnippetFromContent = (
  content: Array<{ text: string }>,
  title: string
): string => {
  const text = content[0]?.text ?? "";
  try {
    const parsed = JSON.parse(text);
    if (parsed.lines && Array.isArray(parsed.lines)) {
      return extractSnippet(parsed.lines, { title });
    }
  } catch {}
  return "";
};

const data = async (c: Context) => {
  const query = c.urlParsed.search.q;

  if (!query) {
    return {
      ok: true,
      payload: {
        query: "",
        results: [] as SearchResult[],
      },
    };
  }

  const response = await c.env.AI.autorag("w-rag").search({
    query,
    max_num_results: 20,
  });

  const results: SearchResult[] = response.data
    .map((item) => {
      const content = item.content as Array<{ text: string }>;
      const title = extractTitle(content);
      if (!title) return null;
      return {
        title,
        snippet: extractSnippetFromContent(content, title),
        score: item.score,
      };
    })
    .filter((item): item is SearchResult => item !== null);

  return {
    ok: true,
    payload: {
      query,
      results,
    },
  };
};

export default data;
