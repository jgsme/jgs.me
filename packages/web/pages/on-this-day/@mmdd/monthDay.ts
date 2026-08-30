// 周年日記は年を持たないので、暦は閏年 1 年分を輪にして扱う。2/29 の記事も
// 実在するため、2/28 の次は 2/29 とする。12/31 の次は 1/1 に巻き戻る。
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const CYCLE: string[] = [];
for (let month = 1; month <= 12; month++) {
  for (let day = 1; day <= DAYS_IN_MONTH[month - 1]; day++) {
    CYCLE.push(
      `${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`,
    );
  }
}

// 暦に存在する月日か。"0431" や "0230" は false。
export function isMonthDay(mmdd: string): boolean {
  return CYCLE.includes(mmdd);
}

// "0401" -> "04-01"。暦に無い月日なら null。article.date の後半 5 文字と
// 突き合わせる形に揃える。
export function toMonthDay(mmdd: string): string | null {
  if (!isMonthDay(mmdd)) return null;
  return `${mmdd.slice(0, 2)}-${mmdd.slice(2, 4)}`;
}

// "0401" -> "4月1日"。
export function monthDayLabel(mmdd: string): string {
  return `${Number(mmdd.slice(0, 2))}月${Number(mmdd.slice(2, 4))}日`;
}

// 前後の日。年をまたぐ端 (12/31 と 1/1) は輪でつなぐ。暦に無い月日なら null。
export function adjacentDays(
  mmdd: string,
): { prev: string; next: string } | null {
  const i = CYCLE.indexOf(mmdd);
  if (i < 0) return null;
  return {
    prev: CYCLE[(i - 1 + CYCLE.length) % CYCLE.length],
    next: CYCLE[(i + 1) % CYCLE.length],
  };
}
