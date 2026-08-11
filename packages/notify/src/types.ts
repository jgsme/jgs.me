export type Action = "register" | "clip" | "exclude";

export type PageSummary = {
  id: number;
  title: string;
};

export type ActionButton = {
  type: 2;
  style: 1 | 2 | 4;
  label: string;
  custom_id: string;
  disabled?: boolean;
};

export type LinkButton = {
  type: 2;
  style: 5;
  label: string;
  url: string;
};

export type Button = ActionButton | LinkButton;

export type ActionRow = {
  type: 1;
  components: Button[];
};

export type DiscordMessage = {
  content: string;
  components: ActionRow[];
};

export type ActionResult =
  | { status: "ok"; title: string }
  | { status: "already"; title: string }
  | { status: "notfound" };

export type Interaction = {
  type: number;
  data?: { custom_id?: string };
  message?: { components?: ActionRow[] };
};
