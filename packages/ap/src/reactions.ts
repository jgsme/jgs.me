export type ReactionKind = "like" | "emoji" | "announce" | "reply" | "mention";

type Activity = Record<string, unknown>;

function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

// 自サイトの /o/<page.id> を指しているときだけ受け付ける。
// 他所の URI を対象にした反応が紛れ込むのを防ぐ。
export function pageIDFromObjectURI(
  uri: string,
  siteUrl: string,
): number | null {
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return null;
  }
  if (u.origin !== new URL(siteUrl).origin) return null;

  const m = u.pathname.match(/^\/o\/(\d+)\/?$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function kindOf(activity: Activity): ReactionKind | null {
  switch (activity.type) {
    case "Like":
      return "like";
    // Misskey のリアクション。Like を置き換える扱いなので、
    // これを落とすと日本語圏の反応が丸ごと届かなくなる。
    case "EmojiReact":
      return "emoji";
    case "Announce":
      return "announce";
    case "Create": {
      const obj = asObject(activity.object);
      // inReplyTo が無い Create は他人のタイムライン投稿。こちらでは扱わない。
      return obj && typeof obj.inReplyTo === "string" ? "reply" : null;
    }
    default:
      return null;
  }
}

export function targetURIOf(activity: Activity): string | null {
  if (activity.type === "Create") {
    const obj = asObject(activity.object);
    const r = obj?.inReplyTo;
    return typeof r === "string" ? r : null;
  }
  if (typeof activity.object === "string") return activity.object;
  const obj = asObject(activity.object);
  return typeof obj?.id === "string" ? obj.id : null;
}

// 同じ反応が二度届いても1行にするため、activity の id を主キーに使う。
// ただし Create(返信) だけは Note の id を使う。Delete が指してくるのは
// Note の id であって Create activity の id ではないため、ここを揃えないと
// 相手が返信を消しても Delete が1行も当たらない
// (Like / Announce は Undo で処理されるので、あの分岐が効くのは実質 reply だけ)。
// 同じ返信が別の activity id で再送されたときの重複排除も Note 単位で正しくなる。
export function reactionIDOf(activity: Activity): string | null {
  if (activity.type === "Create") {
    const obj = asObject(activity.object);
    return typeof obj?.id === "string" ? obj.id : null;
  }
  return typeof activity.id === "string" ? activity.id : null;
}
