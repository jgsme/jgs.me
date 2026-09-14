// article は /a/:id、clip は /c/:id。どちらも server/routes/redirects.ts が
// 受けて /pages/<title> に飛ばす。共有 URL (shareUrl.ts) と RSS の link/guid が
// 同じ形を組むので、形はここ 1 箇所に置く。
export const articlePath = (id: number) => `/a/${id}`;
export const clipPath = (id: number) => `/c/${id}`;
