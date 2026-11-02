import { createSession, putRecord } from "./pdsClient.ts";
import { putPublicationBody } from "./standardPublicationRecord.ts";

const ARGV_OFFSET = 2;

function usage(): never {
  console.error(
    [
      "usage: pnpm standard-publication",
      "",
      "  site.standard.publication record を PDS (ds.jgs.me) に書く。",
      "  rkey は固定なので、何度流しても同じ record を上書きするだけ。",
      "",
      "  環境変数: PDS_IDENTIFIER / PDS_PASSWORD",
      "            PDS_URL (既定 https://ds.jgs.me)",
    ].join("\n"),
  );
  process.exit(1);
}

if (process.argv.length > ARGV_OFFSET) usage();

const session = await createSession();
const { uri, cid } = await putRecord(session, putPublicationBody(session.did));
console.log(`uri: ${uri}`);
console.log(`cid: ${cid}`);
