export type Action = "register" | "clip" | "exclude";

export type PageSummary = {
  id: number;
  title: string;
};

// Components V2 のトップレベルに置ける型のうち、このワーカーが使うものだけ。
// https://docs.discord.com/developers/components/reference

export type ActionButton = {
  type: 2;
  style: 1 | 2 | 4;
  label: string;
  custom_id: string;
  disabled?: boolean;
};

export type ActionRow = {
  type: 1;
  components: ActionButton[];
};

export type TextDisplay = {
  type: 10;
  content: string;
};

export type Separator = {
  type: 14;
  divider: boolean;
  spacing: number;
};

export type MessageComponent = ActionRow | TextDisplay | Separator;

// V2 では content / embeds が使えず、本文も components で表現する。
export type DiscordMessage = {
  flags: number;
  components: MessageComponent[];
};

export type ActionResult =
  | { status: "ok"; title: string }
  | { status: "already"; title: string }
  | { status: "notfound" };

export type Interaction = {
  type: number;
  // followup を送るのに使う。deferred で返した後に @original を書き換える
  token?: string;
  data?: { custom_id?: string; name?: string };
  message?: { components?: MessageComponent[] };
};
