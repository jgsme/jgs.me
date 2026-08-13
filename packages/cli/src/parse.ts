function toPageId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) {
    return null;
  }
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function parseTarget(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") {
    return null;
  }

  if (/^https?:\/\//.test(trimmed)) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return null;
    }
    const match = url.pathname.match(/^\/p\/(\d+)\/?$/);
    return match ? toPageId(match[1]) : null;
  }

  return toPageId(trimmed);
}
