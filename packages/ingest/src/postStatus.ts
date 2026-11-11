export type PostStatus = "draft" | "published";

// JSON 形式は値を配列で包むので、素の値と ["..."] の両方を取る。
// 読めない値は published に倒さず投げる。黙って published にすると、
// 下書きのつもりの投稿がそのまま公開される。
export function readPostStatus(
  props: Record<string, unknown>,
): PostStatus | null {
  const v = props["post-status"];
  if (v === undefined) return null;
  const value = Array.isArray(v) ? v[0] : v;
  if (value === "draft" || value === "published") return value;
  throw new Error("post-status must be draft or published");
}

export function payloadPostStatus(payload: unknown): PostStatus | null {
  if (!payload || typeof payload !== "object") return null;
  const props = (payload as { properties?: unknown }).properties;
  if (!props || typeof props !== "object" || Array.isArray(props)) return null;
  return readPostStatus(props as Record<string, unknown>);
}

// post-status は保存する mf2 に残さない。状態は draft 表の有無で持つ。
export function stripPostStatus(
  props: Record<string, unknown>,
): Record<string, unknown> {
  const { "post-status": _omit, ...rest } = props;
  return rest;
}

// 公開済みのページを下書きに戻す経路は無い。update で draft を受けない。
export function assertNotDraft(props: Record<string, unknown>): void {
  if (readPostStatus(props) === "draft") {
    throw new Error("a published page cannot go back to draft");
  }
}
