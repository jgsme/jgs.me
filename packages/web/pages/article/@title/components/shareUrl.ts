import { articlePath, clipPath, zetPermalinkPath } from "@/utils/permalink";

// 共有 URL のパス。article / clip / zet のどれでもないページには共有 URL が無い。
export const shareUrlPath = ({
  articleId,
  clipId,
  zetId,
}: {
  articleId: number | null;
  clipId: number | null;
  zetId: number | null;
}): string | null => {
  if (articleId !== null) return articlePath(articleId);
  if (clipId !== null) return clipPath(clipId);
  if (zetId !== null) return zetPermalinkPath(zetId);
  return null;
};
