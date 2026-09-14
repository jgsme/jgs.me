// 候補リストのキーボード移動。-1 は「候補を選んでいない = 入力欄そのもの」で、
// 候補と合わせて length + 1 個の環を回る。末尾で止めずに入力欄へ戻すのは、
// 打った文字列そのままで検索し直せるようにするため。
export const nextActiveIndex = (
  current: number,
  length: number,
  delta: 1 | -1,
): number => {
  if (length === 0) return -1;
  // 候補が減った後に古い index が残ることがある。選択は壊れているので
  // 未選択から押し直したのと同じ扱いにする。
  const from = current >= 0 && current < length ? current : -1;
  const size = length + 1;
  return ((((from + 1 + delta) % size) + size) % size) - 1;
};
