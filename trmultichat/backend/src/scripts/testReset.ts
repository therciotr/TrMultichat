/* Minimal e2e-like check for reset-password endpoint using a real token */
import http from "http";

function postJson(
  url: string,
  data: unknown
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const payload = Buffer.from(JSON.stringify(data), "utf8");
      let port = u.port ? Number(u.port) : 0;
      if (!port) {
        port = u.protocol === "https:" ? 443 : 80;
      }
      const req = http.request(
        {
          hostname: u.hostname,
          port,
          path: u.pathname + (u.search || ""),
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": String(payload.length)
          }
        },
        res => {
          const chunks: Buffer[] = [];
          res.on("data", c =>
            chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c))
          );
          res.on("end", () => {
            resolve({
              status: res.statusCode || 0,
              body: Buffer.concat(chunks).toString("utf8")
            });
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
  const newPassword = process.env.TEST_NEW_PASSWORD || "NovaSenha!123";

  const forgotUrl = `${base.replace(/\/$/, "")}/auth/forgot-password`;
  const resetUrl = `${base.replace(/\/$/, "")}/auth/reset-password`;

  // 1) Get token via forgot-password
  const forgotRes = await postJson(forgotUrl, { email });
  if (forgotRes.status !== 200) {
    console.error("FAIL_FORGOT_STATUS", forgotRes.status, forgotRes.body);
    process.exit(1);
  }
  let token: string | null = null;
  try {
    const json = JSON.parse(forgotRes.body);
    if (!json || json.ok !== true || typeof json.link !== "string") {
      console.error("FAIL_FORGOT_BODY", json);
      process.exit(1);
    }
    const url = new URL(json.link);
    token = url.searchParams.get("token");
  } catch (e) {
    console.error("FAIL_FORGOT_PARSE", e);
    process.exit(1);
  }
  if (!token) {
    console.error("FAIL_NO_TOKEN");
    process.exit(1);
  }

  // 2) Use token once - should succeed
  const okRes = await postJson(resetUrl, { token, password: newPassword });
  if (okRes.status !== 200) {
    console.error("FAIL_RESET_STATUS", okRes.status, okRes.body);
    process.exit(1);
  }
  try {
    const json = JSON.parse(okRes.body);
    if (!json || json.ok !== true) {
      console.error("FAIL_RESET_BODY", json);
      process.exit(1);
    }
  } catch (e) {
    console.error("FAIL_RESET_PARSE", e);
    process.exit(1);
  }

  // 3) Invalid token should NOT succeed with ok=true
  const invalidRes = await postJson(resetUrl, {
    token: "token-invalido",
    password: newPassword
  });
  let invalidIsOk = false;
  try {
    const json = JSON.parse(invalidRes.body);
    invalidIsOk = invalidRes.status === 200 && json && json.ok === true;
  } catch {
    invalidIsOk = false;
  }
  if (invalidIsOk || invalidRes.status < 400) {
    console.error("FAIL_INVALID_TOKEN", {
      status: invalidRes.status,
      body: invalidRes.body
    });
    process.exit(1);
  }

  console.log("OK_RESET_FLOW", {
    statusFirst: okRes.status,
    statusInvalid: invalidRes.status
  });
  process.exit(0);
}

main().catch(e => {
  console.error("FAIL_EX", e?.message || e);
  process.exit(1);
});
