import type {
  Action,
  ActionResult,
  ActionRow,
  DiscordMessage,
  PageSummary,
} from "./types";

export const ROWS_PER_MESSAGE = 5;

const LABEL_MAX = 80;

const DONE_VERB: Record<Action, string> = {
  register: "記事に登録",
  clip: "クリップ",
  exclude: "除外",
};

export function truncateLabel(label: string): string {
  if (label.length <= LABEL_MAX) return label;
  return label.slice(0, LABEL_MAX - 1) + "…";
}

export function buildRow(page: PageSummary, siteUrl: string): ActionRow {
  return {
    type: 1,
    components: [
      {
        type: 2,
        style: 1,
        label: truncateLabel(`📝 ${page.title}`),
        custom_id: `a:register:${page.id}`,
      },
      {
        type: 2,
        style: 5,
        label: "🔗",
        url: `https://${siteUrl}/p/${page.id}`,
      },
      { type: 2, style: 2, label: "📎", custom_id: `a:clip:${page.id}` },
      { type: 2, style: 4, label: "🚫", custom_id: `a:exclude:${page.id}` },
    ],
  };
}

export function buildMessages(
  pages: PageSummary[],
  siteUrl: string,
): DiscordMessage[] {
  const messages: DiscordMessage[] = [];
  for (let i = 0; i < pages.length; i += ROWS_PER_MESSAGE) {
    messages.push({
      content:
        i === 0
          ? `**未登録の記事が ${pages.length} 件あるよ**`
          : "**(つづき)**",
      components: pages
        .slice(i, i + ROWS_PER_MESSAGE)
        .map((page) => buildRow(page, siteUrl)),
    });
  }
  return messages;
}

export function resultLabel(action: Action, result: ActionResult): string {
  if (result.status === "notfound") return "⚠️ ページが見つからない";
  const verb = DONE_VERB[action];
  const body =
    result.status === "ok"
      ? `✅ ${result.title} — ${verb}した`
      : `⚠️ ${result.title} — 既に${verb}済み`;
  return truncateLabel(body);
}
