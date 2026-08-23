// Micropub の update は replace / add / delete の 3 操作を 1 リクエストで受ける。
// https://www.w3.org/TR/micropub/#update
// 値は create と同じく常に配列で来る。
export type UpdateAction = {
  url: string;
  replace: Record<string, unknown[]>;
  add: Record<string, unknown[]>;
  // delete はプロパティ名の配列と、値を指定するオブジェクトの両方がある。
  //   ["category"]            → category を丸ごと消す
  //   { category: ["x"] }     → category から "x" だけ消す
  deleteProps: string[];
  deleteValues: Record<string, unknown[]>;
};

type Props = Record<string, unknown>;

function asPropMap(v: unknown, field: string): Record<string, unknown[]> {
  if (v === undefined) return {};
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    throw new Error(`${field} must be an object`);
  }
  const out: Record<string, unknown[]> = {};
  for (const [key, value] of Object.entries(v as Props)) {
    if (!Array.isArray(value)) {
      throw new Error(`${field}.${key} must be an array`);
    }
    out[key] = value;
  }
  return out;
}

export function parseUpdateAction(payload: unknown): UpdateAction {
  if (!payload || typeof payload !== "object") {
    throw new Error("url is required");
  }
  const p = payload as {
    url?: unknown;
    replace?: unknown;
    add?: unknown;
    delete?: unknown;
  };

  if (typeof p.url !== "string" || p.url === "") {
    throw new Error("url is required");
  }

  const replace = asPropMap(p.replace, "replace");
  const add = asPropMap(p.add, "add");

  let deleteProps: string[] = [];
  let deleteValues: Record<string, unknown[]> = {};
  if (Array.isArray(p.delete)) {
    deleteProps = p.delete.map((k) => {
      if (typeof k !== "string") throw new Error("delete must be strings");
      return k;
    });
  } else {
    deleteValues = asPropMap(p.delete, "delete");
  }

  if (
    Object.keys(replace).length === 0 &&
    Object.keys(add).length === 0 &&
    deleteProps.length === 0 &&
    Object.keys(deleteValues).length === 0
  ) {
    throw new Error("replace, add or delete is required");
  }

  return { url: p.url, replace, add, deleteProps, deleteValues };
}

// 値の同一判定。content は { html: "..." } のようなオブジェクトも取るので、
// 参照比較では消せない。構造を JSON にして比べる。キー順が違うと別物になるが、
// 消す側は元の値をそのまま送ってくる前提なので実用上は足りる。
function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// 元の properties は書き換えず、新しいオブジェクトを返す。
// 適用順は delete → replace → add。同じリクエストで delete と add が
// 同じプロパティに来たとき、「消してから足す」が意図に近い。
export function applyUpdate(props: Props, action: UpdateAction): Props {
  const next: Props = { ...props };

  for (const key of action.deleteProps) {
    delete next[key];
  }

  for (const [key, values] of Object.entries(action.deleteValues)) {
    const current = next[key];
    if (!Array.isArray(current)) continue;
    const kept = current.filter((v) => !values.some((d) => sameValue(v, d)));
    // 全部消えたらプロパティ自体を落とす。空配列を残すと
    // 「値の無いプロパティ」が mf2 に残り続ける。
    if (kept.length === 0) delete next[key];
    else next[key] = kept;
  }

  for (const [key, values] of Object.entries(action.replace)) {
    if (values.length === 0) delete next[key];
    else next[key] = values;
  }

  for (const [key, values] of Object.entries(action.add)) {
    if (values.length === 0) continue;
    const current = next[key];
    next[key] = Array.isArray(current) ? [...current, ...values] : [...values];
  }

  return next;
}
