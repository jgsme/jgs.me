import { describe, expect, it } from "vitest";
import {
  DOCUMENT_COLLECTION,
  DOCUMENT_COPY_PROTOCOL,
  HTML_CONTENT_TYPE,
  PUBLICATION_AT_URI,
  PUBLICATION_COLLECTION,
  PUBLICATION_NAME,
  PUBLICATION_RKEY,
  PUBLICATION_URL,
  STANDARD_DID,
  documentAtUri,
} from "./standard";
import { ZET_COPY_PROTOCOL, ZET_DID } from "./zet";

describe("standard.site の定数", () => {
  it("DID は zet と同じ PDS", () => {
    expect(STANDARD_DID).toBe(ZET_DID);
  });
  it("collection / rkey / url / name / content type", () => {
    expect(DOCUMENT_COLLECTION).toBe("site.standard.document");
    expect(PUBLICATION_COLLECTION).toBe("site.standard.publication");
    expect(PUBLICATION_RKEY).toBe("w.jgs.me");
    expect(PUBLICATION_URL).toBe("https://w.jgs.me");
    expect(PUBLICATION_NAME).toBe("I am Electrical machine");
    expect(HTML_CONTENT_TYPE).toBe("me.jgs.diary.html");
  });
  it("publication の at-uri", () => {
    expect(PUBLICATION_AT_URI).toBe(
      "at://did:web:ds.jgs.me/site.standard.publication/w.jgs.me",
    );
  });
  it("document の at-uri", () => {
    expect(documentAtUri("3m2abcdefghij")).toBe(
      "at://did:web:ds.jgs.me/site.standard.document/3m2abcdefghij",
    );
  });
  it("copy の protocol は zet とも bsky 投稿とも違う", () => {
    expect(DOCUMENT_COPY_PROTOCOL).toBe("atproto-document");
    expect(DOCUMENT_COPY_PROTOCOL).not.toBe(ZET_COPY_PROTOCOL);
    expect(DOCUMENT_COPY_PROTOCOL).not.toBe("atproto");
  });
});
