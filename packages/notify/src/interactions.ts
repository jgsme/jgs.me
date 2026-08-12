import { PULL_COMMAND } from "./commands";
import type { Action, Interaction, MessageComponent } from "./types";

const ACTIONS = [
  "register",
  "clip",
  "exclude",
] as const satisfies readonly Action[];

export type Decision =
  | { kind: "pong" }
  | { kind: "command"; name: typeof PULL_COMMAND }
  | { kind: "component"; action: Action; pageId: number }
  | { kind: "unknown" };

export function parseCustomId(
  customId: string,
): { action: Action; pageId: number } | null {
  const parts = customId.split(":");
  if (parts.length !== 3) return null;

  const [prefix, action, rawId] = parts;
  if (prefix !== "a") return null;
  if (!ACTIONS.includes(action as Action)) return null;
  if (!/^\d+$/.test(rawId)) return null;

  return { action: action as Action, pageId: Number(rawId) };
}

export function decide(interaction: Interaction): Decision {
  if (interaction.type === 1) return { kind: "pong" };

  if (interaction.type === 2) {
    if (interaction.data?.name !== PULL_COMMAND) return { kind: "unknown" };
    return { kind: "command", name: PULL_COMMAND };
  }

  if (interaction.type !== 3) return { kind: "unknown" };

  const parsed = parseCustomId(interaction.data?.custom_id ?? "");
  if (!parsed) return { kind: "unknown" };

  return { kind: "component", action: parsed.action, pageId: parsed.pageId };
}

// Components V2 のトップレベルには Text Display や Separator も混ざるので、
// ボタン行 (type 1) だけを見て、該当する 1 行を結果表示に差し替える。
export function replaceRow(
  components: MessageComponent[],
  pageId: number,
  label: string,
): MessageComponent[] {
  return components.map((component) => {
    if (component.type !== 1) return component;

    const hit = component.components.some(
      (button) => parseCustomId(button.custom_id)?.pageId === pageId,
    );
    if (!hit) return component;

    return {
      type: 1,
      components: [
        {
          type: 2,
          style: 2,
          label,
          custom_id: `done:${pageId}`,
          disabled: true,
        },
      ],
    };
  });
}
