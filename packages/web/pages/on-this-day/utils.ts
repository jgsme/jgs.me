import { OnThisDayIndex } from "./+data";

export type StackBlock = {
  year: number;
  count: number;
  yearIndex: number;
};

export type GridCell = {
  dateStr: string; // "MM-DD"
  month: number; // 1-12
  day: number; // 1-31
  weekIndex: number;
  dayIndex: number; // 0 (Sun) - 6 (Sat)
  stacks: StackBlock[];
};

export function processData(index: OnThisDayIndex): {
  cells: GridCell[];
  years: number[];
} {
  const { years, entries } = index;
  const cells: GridCell[] = [];

  const baseYear = 1928;
  const startDate = new Date(baseYear, 0, 1);
  const oneDayMs = 24 * 60 * 60 * 1000;
  const startDayOfWeek = startDate.getDay();

  for (let i = 0; i < 366; i++) {
    const currentDate = new Date(startDate.getTime() + i * oneDayMs);
    const month = currentDate.getMonth() + 1;
    const day = currentDate.getDate();
    const mm = month.toString().padStart(2, "0");
    const dd = day.toString().padStart(2, "0");
    const mmdd = `${mm}${dd}`;

    const dayIndex = currentDate.getDay();
    const offsetDate = new Date(startDate);
    offsetDate.setDate(startDate.getDate() - startDayOfWeek);

    const diffTime = currentDate.getTime() - offsetDate.getTime();
    const diffDays = Math.floor(diffTime / oneDayMs);
    const weekIndex = Math.floor(diffDays / 7);

    const entryList = entries[mmdd] || [];
    const stacks: StackBlock[] = entryList.map(([yearIndex, count]) => ({
      year: years[yearIndex],
      yearIndex,
      count,
    }));

    stacks.sort((a, b) => a.year - b.year);

    cells.push({
      dateStr: `${mm}-${dd}`,
      month,
      day,
      weekIndex,
      dayIndex,
      stacks,
    });
  }

  return { cells, years };
}

export function getYearColor(yearIndex: number, totalYears: number): string {
  const hue = totalYears > 1 ? (yearIndex / (totalYears - 1)) * 280 : 0;
  return `hsl(${hue}, 70%, 50%)`;
}
