export const PULL_COMMAND = "pull";

export type CommandDefinition = {
  name: string;
  description: string;
  type: 1;
  contexts: number[];
};

// PUT /applications/{id}/commands は全置換なので、この配列がそのまま登録済みの
// コマンド一覧になる。contexts: [0] はギルド内のみ (DM では出さない)。
export function buildCommandsPayload(): CommandDefinition[] {
  return [
    {
      name: PULL_COMMAND,
      description: "未登録の記事を今すぐ流す",
      type: 1,
      contexts: [0],
    },
  ];
}

export function pullResultMessage(count: number): string {
  if (count === 0) return "全部片付いてる。流すものなし";
  return `${count} 件流した`;
}
