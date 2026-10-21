import type { Env } from "./index";

// news (git.jgs.me/o/news) が clef を Workers AI の REST API ではなく binding 経由で呼ぶための薄い中継。
// 質問文や version は news 側が持ち、ここは形だけ確かめてそのまま渡し、結果もそのまま返す。

export const CLEF_MODEL = "@cf/cloudflare/clef";
export const MAX_QUESTIONS = 8;

const BAD_REQUEST = 400;
const BAD_GATEWAY = 502;

export type ClefInput = {
  readonly state: string | Readonly<Record<string, unknown>>;
  readonly questions: Readonly<
    Record<string, Readonly<Record<string, unknown>>>
  >;
};

export type ClefDeps = {
  readonly run: (input: ClefInput) => Promise<unknown>;
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** 形が違えば理由を返す。質問の type の種類 (noul / choice など) は clef 側に任せて縛らない */
export function parseClefInput(
  body: unknown,
): { readonly input: ClefInput } | { readonly error: string } {
  if (!isObject(body)) return { error: "body must be an object" };
  const { state, questions } = body;
  const stateOk =
    (typeof state === "string" && state !== "") || isObject(state);
  if (!stateOk) return { error: "state must be a non-empty string or object" };
  if (!isObject(questions)) return { error: "questions must be an object" };
  const entries = Object.entries(questions);
  if (entries.length === 0 || entries.length > MAX_QUESTIONS) {
    return { error: `questions must have 1-${MAX_QUESTIONS} entries` };
  }
  const bad = entries.find(
    ([, q]) => !isObject(q) || typeof q.type !== "string",
  );
  if (bad) return { error: `question ${bad[0]} must have a string type` };
  return {
    input: { state, questions: questions as ClefInput["questions"] },
  };
}

export async function runClef(
  deps: ClefDeps,
  body: unknown,
): Promise<Response> {
  const parsed = parseClefInput(body);
  if ("error" in parsed) {
    return Response.json({ error: parsed.error }, { status: BAD_REQUEST });
  }
  try {
    return Response.json(await deps.run(parsed.input));
  } catch (e) {
    // 中身は Workers のログにだけ残す。呼び出し側には state を含みうるメッセージを返さない
    console.error("clef failed", e);
    return Response.json({ error: "clef failed" }, { status: BAD_GATEWAY });
  }
}

// clef は workers-types の AiModelList にまだ無いので、名前を文字列で渡せる形に寄せて呼ぶ
type ClefBinding = {
  run(model: string, inputs: ClefInput, options?: AiOptions): Promise<unknown>;
};

export async function handleClef(
  request: Request,
  env: Env,
): Promise<Response> {
  const body = await request.json().catch(() => null);
  if (body === null) {
    return Response.json({ error: "invalid json" }, { status: BAD_REQUEST });
  }
  const ai = env.AI as unknown as ClefBinding;
  const options = env.AI_GATEWAY_ID
    ? { gateway: { id: env.AI_GATEWAY_ID } }
    : undefined;
  return runClef({ run: (input) => ai.run(CLEF_MODEL, input, options) }, body);
}
