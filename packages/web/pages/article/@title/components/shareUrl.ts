import { articlePath, clipPath } from "@/utils/permalink";

// 共有 URL のパス。どちらでもないページには共有 URL が無い。
export const shareUrlPath = ({
  articleId,
  clipId,
}: {
  articleId: number | null;
  clipId: number | null;
}): string | null => {
  if (articleId !== null) return articlePath(articleId);
  if (clipId !== null) return clipPath(clipId);
  return null;
};
