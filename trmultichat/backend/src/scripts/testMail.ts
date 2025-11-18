/* Simple check for forgot-password endpoint (mail flow) */
import http from "http";

function postJson(url: string, data: unknown): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const payload = Buffer.from(JSON.stringify(data), "utf8");
      const req = http.request(
        {
          hostname: u.hostname,
          port: u.port ? Number(u.port) : (u.protocol === "https:" ? 443 : 80),
          path: u.pathname + (u.search || ""),
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": String(payload.length)
          }
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
          res.on("end", () => {
            resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks).toString("utf8") });
          });
        }
      );
      req.on("error", reject);
      req.write(payload);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

async function main() {
  const base = process.env.BACKEND_URL || "http://127.0.0.1:4004";
  const email = process.env.TEST_EMAIL || "renilda@trtecnologias.com.br";
  const url = `${base.replace(/\/$/, "")}/auth/forgot-password`;
  const { status, body } = await postJson(url, { email });
  try {
    const json = JSON.parse(body);
    const ok = status === 200 && json && json.ok === true;
    if (!ok) {
      console.error("FAIL_MAIL", { status, json });
      process.exit(1);
    }
    console.log("OK_MAIL", { status });
    process.exit(0);
  } catch (e) {
    console.error("FAIL_MAIL_PARSE", { status, body });
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("FAIL_MAIL_EX", e?.message || e);
  process.exit(1);
});


