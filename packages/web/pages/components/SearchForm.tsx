import React, { useState, useEffect } from "react";

export const SearchForm: React.FC = () => {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) setQuery(q);
  }, []);

  return (
    <form action="/search" method="get">
      <div className="flex gap-2 my-2">
        <input
          type="text"
          name="q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="検索..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-gray-500"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded border border-solid border-gray-500 hover:bg-gray-100"
        >
          検索
        </button>
      </div>
    </form>
  );
};
