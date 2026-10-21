import { describe, expect, it } from "vitest";
import { MAX_QUESTIONS, parseClefInput, runClef, type ClefInput } from "./clef";

const BAD_REQUEST = 400;
const BAD_GATEWAY = 502;
const OK = 200;
const RELATED = 0.96;
const TOKENS = 158;

const QUESTIONS = { related: { type: "noul", instructions: "関係あるか" } };

function recorder(result: unknown) {
  const seen: ClefInput[] = [];
  return {
    seen,
    deps: {
      run: async (input: ClefInput) => {
        seen.push(input);
        return result;
      },
    },
  };
}

describe("parseClefInput", () => {
  it("state は文字列でも object でも通し、質問の type は縛らない", () => {
    expect(
      parseClefInput({ state: "## candidate", questions: QUESTIONS }),
    ).toEqual({ input: { state: "## candidate", questions: QUESTIONS } });
    const choice = { pick: { type: "choice", options: ["a", "b"] } };
    expect(
      parseClefInput({ state: { title: "t" }, questions: choice }),
    ).toEqual({ input: { state: { title: "t" }, questions: choice } });
  });

  it("形が違えば理由を返す", () => {
    const tooMany = Object.fromEntries(
      Array.from({ length: MAX_QUESTIONS + 1 }, (_, i) => [
        `q${i}`,
        { type: "noul" },
      ]),
    );
    const cases: [unknown, string][] = [
      [null, "body must be an object"],
      [[], "body must be an object"],
      [{ state: "", questions: QUESTIONS }, "state must be"],
      [{ state: 1, questions: QUESTIONS }, "state must be"],
      [{ state: "s", questions: [] }, "questions must be an object"],
      [{ state: "s", questions: {} }, `1-${MAX_QUESTIONS} entries`],
      [{ state: "s", questions: tooMany }, `1-${MAX_QUESTIONS} entries`],
      [{ state: "s", questions: { a: { noType: 1 } } }, "question a must"],
      [{ state: "s", questions: { a: "noul" } }, "question a must"],
    ];
    cases.forEach(([body, reason]) => {
      const r = parseClefInput(body);
      expect("error" in r && r.error).toContain(reason);
    });
  });
});

describe("runClef", () => {
  it("state と questions だけを渡し、binding の結果をそのまま返す", async () => {
    const result = {
      answers: { related: { type: "noul", noul: RELATED } },
      usage: { input_tokens: TOKENS },
    };
    const { seen, deps } = recorder(result);
    const res = await runClef(deps, {
      state: "s",
      questions: QUESTIONS,
      extra: "落とす",
    });
    expect(res.status).toBe(OK);
    expect(await res.json()).toEqual(result);
    expect(seen).toEqual([{ state: "s", questions: QUESTIONS }]);
  });

  it("形が違えば binding を呼ばずに 400", async () => {
    const { seen, deps } = recorder({});
    const res = await runClef(deps, { state: "s" });
    expect(res.status).toBe(BAD_REQUEST);
    expect(await res.json()).toEqual({ error: "questions must be an object" });
    expect(seen).toEqual([]);
  });

  it("binding が失敗したら 502 で error key だけ返し、中身は漏らさない", async () => {
    const res = await runClef(
      {
        run: async () => {
          throw new Error("upstream said: secret state");
        },
      },
      { state: "secret state", questions: QUESTIONS },
    );
    expect(res.status).toBe(BAD_GATEWAY);
    expect(await res.json()).toEqual({ error: "clef failed" });
  });
});
