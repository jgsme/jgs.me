// actor の鍵ペアを1回だけ生成する。
// 秘密鍵は Secrets に、公開鍵は vars に入れる。
// この秘密鍵が actor の identity そのもの。失うと同じ actor を名乗れない。
const { privateKey, publicKey } = await crypto.subtle.generateKey(
  {
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256",
  },
  true,
  ["sign", "verify"],
);

const wrap = (label, buf) => {
  const b64 = Buffer.from(new Uint8Array(buf)).toString("base64");
  return `-----BEGIN ${label}-----\n${b64.match(/.{1,64}/g).join("\n")}\n-----END ${label}-----`;
};

console.log(
  wrap("PRIVATE KEY", await crypto.subtle.exportKey("pkcs8", privateKey)),
);
console.log();
console.log(
  wrap("PUBLIC KEY", await crypto.subtle.exportKey("spki", publicKey)),
);
