// 共有 URL のパス。article は /a/:id、clip は /c/:id (どちらも redirects.ts で
// /pages/<title> に飛ぶ)。どちらでもないページには共有 URL が無い。
export const shareUrlPath = ({
  articleId,
  clipId,
}: {
  articleId: number | null;
  clipId: number | null;
}): string | null => {
  if (articleId !== null) return `/a/${articleId}`;
  if (clipId !== null) return `/c/${clipId}`;
  return null;
};
