import { PULL_COMMAND } from "./commands";
import type { Action, ActionRow, Interaction } from "./types";

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

export function replaceRow(
  rows: ActionRow[],
  pageId: number,
  label: string,
): ActionRow[] {
  return rows.map((row) => {
    const hit = row.components.some(
      (button) =>
        "custom_id" in button &&
        parseCustomId(button.custom_id)?.pageId === pageId,
    );
    if (!hit) return row;

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
