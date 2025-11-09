const { Client } = require("pg");

(async () => {
  const host = process.env.DB_HOST || "postgres";
  const port = Number(process.env.DB_PORT || 5432);
  const user = process.env.DB_USER || "trmultichat_user";
  const password = process.env.DB_PASS || process.env.POSTGRES_PASSWORD || "trmultichat_local";
  const database = process.env.DB_NAME || process.env.POSTGRES_DB || "trmultichat";
  const email = process.env.ADMIN_EMAIL || "thercio@trtecnologias.com.br";
  const client = new Client({ host, port, user, password, database });
  await client.connect();
  try {
    const sqlUpdate = "update \"Users\" set super=true, profile='admin' where email=$1 returning id,email,super,profile";
    const r = await client.query(sqlUpdate, [email]);
    if (r.rowCount === 0) {
      console.log("[promote] usuario nao encontrado:", email);
    } else {
      console.log("[promote] atualizado:", r.rows[0]);
    }
  } finally {
    await client.end();
  }
})().catch((e) => {
  console.error("[promote] erro:", e && e.message ? e.message : e);
  process.exit(1);
});


