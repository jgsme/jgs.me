// 反応の通知は一方向でよいので webhook を直接叩く。
// packages/notify は Discord bot だが、そこに依存を作らない。
export async function notifyDiscord(
  webhookURL: string,
  text: string,
): Promise<void> {
  if (!webhookURL) return;
  try {
    const res = await fetch(webhookURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // allowed_mentions を空にして、本文中の @ で誰も呼ばないようにする。
      body: JSON.stringify({ content: text, allowed_mentions: { parse: [] } }),
    });
    if (!res.ok) {
      console.error(`[discord] failed status=${res.status}`);
    }
  } catch (e) {
    // 通知の失敗で inbox 処理を落とさない。
    console.error(`[discord] error ${String(e)}`);
  }
}
