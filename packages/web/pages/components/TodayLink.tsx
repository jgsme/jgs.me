import React, { useEffect, useState } from "react";

export const TodayLink = () => {
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      setToday(`${month}${day}`);
    }
  }, []);

  return (
    <div className="flex justify-center w-28 h-full">
      <a
        href={today ? `/pages/${today}` : "/on-this-day"}
        className="group relative inline-flex items-center justify-center px-8 font-bold text-white bg-neutral-900 rounded-full overflow-hidden hover:scale-105 active:scale-95 w-full h-full duration-700"
      >
        <div className="absolute inset-0 w-full h-full bg-[url('/warp.gif')] bg-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <span
          className={`relative z-10 text-xl transition-all duration-700 ${
            today ? "opacity-100" : "opacity-0"
          }`}
        >
          {today ? today : ""}
        </span>
      </a>
    </div>
  );
};
