import { describe, expect, it } from "vitest";
import {
  PUBLICATION_COLLECTION,
  PUBLICATION_RKEY,
  publicationRecord,
  putPublicationBody,
} from "./standardPublicationRecord.ts";

describe("standard.site publication", () => {
  it("publication の値は契約どおり", () => {
    expect(publicationRecord()).toEqual({
      $type: "site.standard.publication",
      url: "https://w.jgs.me",
      name: "I am Electrical machine",
    });
  });

  it("putRecord の body", () => {
    expect(putPublicationBody("did:web:ds.jgs.me")).toEqual({
      repo: "did:web:ds.jgs.me",
      collection: "site.standard.publication",
      rkey: "3mz7iuy6k2222",
      record: publicationRecord(),
    });
    expect(PUBLICATION_COLLECTION).toBe("site.standard.publication");
    expect(PUBLICATION_RKEY).toBe("3mz7iuy6k2222");
  });
});
