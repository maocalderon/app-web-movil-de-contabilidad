import { randomBytes, createECDH } from "node:crypto";
import { spawnSync } from "node:child_process";

const ecdh = createECDH("prime256v1");
ecdh.generateKeys();
const publicKey = ecdh.getPublicKey("base64url");
const privateKey = ecdh.getPrivateKey("base64url");
const cronSecret = randomBytes(32).toString("base64url");

for (const [name, value] of [
  ["VAPID_PUBLIC_KEY", publicKey],
  ["VAPID_PRIVATE_KEY", privateKey],
  ["CRON_SECRET", cronSecret],
]) {
  const result = spawnSync(
    "vercel",
    ["env", "add", name, "production", "--sensitive", "--yes", "--force"],
    { input: `${value}\n`, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(
      `No se pudo configurar ${name} en Vercel: ${result.stderr || result.error?.message || "error de CLI"}`,
    );
  }
  console.log(`${name}: configurada como variable sensible de Production`);
}
