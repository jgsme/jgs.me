import React, { useState, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { useData } from "vike-react/useData";
import type { Data } from "./+data";
import { MainScene } from "./components/MainScene";
import { processData, getYearColor } from "./utils";

export function Page() {
  const { index } = useData<Data>();
  const [tooltip, setTooltip] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const { cells, years } = useMemo(() => processData(index), [index]);

  const handleYearClick = (year: number) => {
    setSelectedYear((prev) => (prev === year ? null : year));
  };

  return (
    <div className="h-[calc(100vh-64px)] w-full bg-black text-white relative overflow-hidden">
      <div className="absolute top-6 left-6 z-10 pointer-events-none select-none">
        <div className="mt-6 flex flex-col gap-1.5 bg-slate-950/30 p-4 rounded-xl backdrop-blur-sm border border-white/5 w-fit pointer-events-auto">
          <span className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">
            Years
          </span>
          {years.map((year, i) => {
            const isSelected = selectedYear === year;
            const isDimmed = selectedYear !== null && !isSelected;

            return (
              <button
                key={year}
                onClick={() => handleYearClick(year)}
                className={`flex items-center gap-3 text-xs font-mono transition-opacity duration-200 cursor-pointer ${
                  isDimmed ? "opacity-30" : "opacity-100"
                } hover:opacity-100`}
              >
                <div
                  className="w-3 h-3 rounded-sm shadow-[0_0_8px_rgba(0,0,0,0.5)]"
                  style={{
                    backgroundColor: getYearColor(i, years.length),
                    boxShadow: `0 0 6px ${getYearColor(i, years.length)}`,
                  }}
                />
                <span
                  className={`text-slate-300 ${
                    isSelected ? "font-bold text-white" : ""
                  }`}
                >
                  {year}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {tooltip && (
        <div className="absolute top-6 right-6 z-20 bg-slate-800/90 border border-slate-600/50 p-4 rounded-xl shadow-2xl backdrop-blur-md pointer-events-none animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="font-mono text-sm font-semibold text-white tracking-tight">
            {tooltip}
          </p>
        </div>
      )}
      <Canvas shadows dpr={[1, 2]}>
        <MainScene
          cells={cells}
          years={years}
          setTooltip={setTooltip}
          selectedYear={selectedYear}
        />
      </Canvas>
    </div>
  );
}
