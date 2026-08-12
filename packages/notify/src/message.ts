import type {
  Action,
  ActionResult,
  DiscordMessage,
  MessageComponent,
  PageSummary,
} from "./types";

// メッセージフラグ IS_COMPONENTS_V2 (1 << 15)。これを立てると content /
// embeds が使えなくなり、本文も components で表現することになる。
export const IS_COMPONENTS_V2 = 32768;

// Discord は入れ子のボタンも 1 個として数えて 40 まで。
export const MAX_COMPONENTS = 40;

// 1 記事 = Text Display + Action Row + ボタン 3 個 = 5、記事の間に区切り線 1。
// ヘッダ 1 を足すと 6 記事で 36 になり、上限にちょうど収まる。
export const ARTICLES_PER_MESSAGE = 6;

const DONE_VERB: Record<Action, string> = {
  register: "記事に登録",
  clip: "クリップ",
  exclude: "除外",
};

// markdown のリンクテキストに ] が入るとそこでリンクが切れる。
// バックスラッシュ自体を先に潰さないと二重エスケープになる。
export function escapeLinkText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

export function buildArticleComponents(
  page: PageSummary,
  siteUrl: string,
): MessageComponent[] {
  return [
    {
      type: 10,
      content: `[${escapeLinkText(page.title)}](https://${siteUrl}/p/${page.id})`,
    },
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 1,
          label: "📝 記事",
          custom_id: `a:register:${page.id}`,
        },
        {
          type: 2,
          style: 2,
          label: "📎 クリップ",
          custom_id: `a:clip:${page.id}`,
        },
        {
          type: 2,
          style: 4,
          label: "🚫 除外",
          custom_id: `a:exclude:${page.id}`,
        },
      ],
    },
  ];
}

function separator(): MessageComponent {
  return { type: 14, divider: true, spacing: 1 };
}

export function buildMessages(
  pages: PageSummary[],
  siteUrl: string,
): DiscordMessage[] {
  const messages: DiscordMessage[] = [];

  for (let i = 0; i < pages.length; i += ARTICLES_PER_MESSAGE) {
    const chunk = pages.slice(i, i + ARTICLES_PER_MESSAGE);
    const header: MessageComponent = {
      type: 10,
      content:
        i === 0
          ? `**未登録の記事が ${pages.length} 件あるよ**`
          : "**(つづき)**",
    };

    const body = chunk.flatMap((page, index) => [
      ...(index === 0 ? [] : [separator()]),
      ...buildArticleComponents(page, siteUrl),
    ]);

    messages.push({
      flags: IS_COMPONENTS_V2,
      components: [header, ...body],
    });
  }

  return messages;
}

export function resultLabel(action: Action, result: ActionResult): string {
  if (result.status === "notfound") return "⚠️ ページが見つからない";

  const verb = DONE_VERB[action];
  return result.status === "ok" ? `✅ ${verb}した` : `⚠️ 既に${verb}済み`;
}
