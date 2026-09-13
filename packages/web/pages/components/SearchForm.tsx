import React, { useEffect, useId, useRef, useState } from "react";
import { nextActiveIndex } from "@/utils/suggestNav";

// 打鍵ごとに投げない程度に短く。ここを伸ばすと「打った後に一拍置いて出る」
// 感じになり、インクリメンタルに見えなくなる。
const DEBOUNCE_MS = 150;

type Suggestion = { title: string };

const hrefForTitle = (title: string) => `/pages/${encodeURIComponent(title)}`;

export const SearchForm: React.FC = () => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  // IME 変換中は input に未確定のローマ字が入る。"ni" のような中間状態を
  // 引いても候補にならないので、確定するまで投げない。
  const [composing, setComposing] = useState(false);
  const listID = useId();
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) setQuery(q);
  }, []);

  useEffect(() => {
    // open が立つのは入力かフォーカスのときだけ。URL の q を入れた直後に
    // 候補が開かないようにしている。
    if (!open || composing) return;

    const q = query.trim();
    if (q === "") {
      setSuggestions([]);
      setActiveIndex(-1);
      return;
    }

    // 打鍵が速いと応答の到着順が入れ替わり、古いクエリの候補が残る。
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search/suggest?q=${encodeURIComponent(q)}`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { titles: string[] };
        setSuggestions(data.titles.map((title) => ({ title })));
        setActiveIndex(-1);
      } catch {
        // abort とネットワーク断。サジェストは無くても検索はできるので黙る。
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open, composing]);

  useEffect(() => {
    return () => {
      if (blurTimer.current !== null) clearTimeout(blurTimer.current);
    };
  }, []);

  const close = () => {
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 変換中の Enter は確定、矢印は候補選び。IME から奪うと二重確定になる。
    if (e.nativeEvent.isComposing) return;

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (suggestions.length === 0) return;
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) =>
        nextActiveIndex(i, suggestions.length, e.key === "ArrowDown" ? 1 : -1),
      );
      return;
    }

    if (e.key === "Enter") {
      const picked = open ? suggestions[activeIndex] : undefined;
      // 候補を選んでいなければ submit に任せる。従来どおり /search へ飛び、
      // AI Search のセマンティック検索が走る。
      if (picked === undefined) return;
      e.preventDefault();
      window.location.href = hrefForTitle(picked.title);
      return;
    }

    if (e.key === "Escape") {
      close();
    }
  };

  const expanded = open && suggestions.length > 0;
  const activeID =
    expanded && activeIndex >= 0 ? `${listID}-${activeIndex}` : undefined;

  return (
    <form action="/search" method="get">
      <div className="relative flex gap-2 my-2">
        <input
          type="text"
          name="q"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // 候補の click より先に blur が来る。閉じるのを 1 tick 遅らせる。
            blurTimer.current = setTimeout(close, 0);
          }}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={() => setComposing(false)}
          placeholder="検索..."
          className="flex-1 px-4 py-2 border border-border rounded focus:outline-none focus:border-border-strong"
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listID}
          aria-autocomplete="list"
          aria-activedescendant={activeID}
          autoComplete="off"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded border border-solid border-border-strong hover:bg-surface-strong"
        >
          検索
        </button>

        {/* 位置の基準は relative を持つこの div。form 直下に置くと body 基準の
            absolute になり、画面外に飛ぶ。 */}
        <ul
          id={listID}
          role="listbox"
          hidden={!expanded}
          className="absolute z-10 left-0 right-0 top-full mt-1 max-h-64 overflow-y-auto bg-bg border border-border rounded shadow-lg"
        >
          {suggestions.map((suggestion, i) => (
            <li
              key={suggestion.title}
              id={`${listID}-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className={`px-4 py-2 cursor-pointer truncate ${
                i === activeIndex ? "bg-surface-strong" : "hover:bg-surface"
              }`}
              // mousedown で blur してしまうと click が届かない。
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                window.location.href = hrefForTitle(suggestion.title);
              }}
            >
              {suggestion.title}
            </li>
          ))}
        </ul>
      </div>
    </form>
  );
};
