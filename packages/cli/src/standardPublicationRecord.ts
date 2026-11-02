// standard.site の publication record。cli は @jigsaw/db を import できないので
// 値はここで持ち、テストで契約に固定する。
export const PUBLICATION_COLLECTION = "site.standard.publication";
export const PUBLICATION_RKEY = "3mz7iuy6k2222";

export function publicationRecord() {
  return {
    $type: PUBLICATION_COLLECTION,
    url: "https://w.jgs.me",
    name: "I am Electrical machine",
  } as const;
}

// putRecord は同じ rkey なら上書きなので、何度流しても同じ record になる。
export function putPublicationBody(did: string) {
  return {
    repo: did,
    collection: PUBLICATION_COLLECTION,
    rkey: PUBLICATION_RKEY,
    record: publicationRecord(),
  };
}
