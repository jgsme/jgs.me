import {
  articlePath,
  clipPath,
  druckPath,
  zetPermalinkPath,
} from "@/utils/permalink";

// 共有 URL のパス。article / clip / zet / druck のどれでもないページには共有 URL が無い。
export const shareUrlPath = ({
  articleId,
  clipId,
  zetId,
  druckId,
}: {
  articleId: number | null;
  clipId: number | null;
  zetId: number | null;
  druckId: number | null;
}): string | null => {
  if (articleId !== null) return articlePath(articleId);
  if (clipId !== null) return clipPath(clipId);
  if (zetId !== null) return zetPermalinkPath(zetId);
  if (druckId !== null) return druckPath(druckId);
  return null;
};
