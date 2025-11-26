import { Client } from "pg";
import bcrypt from "bcryptjs";
import path from "path";

async function main() {
  const host = process.env.DB_HOST || "postgres";
  const port = Number(process.env.DB_PORT || 5432);
  const user = process.env.DB_USER || "trmultichat_user";
  const password = process.env.DB_PASS || "trmultichat_local";
  const database = process.env.DB_NAME || "trmultichat";

  const email = process.env.ADMIN_EMAIL || "thercio@trtecnologias.com.br";
  const adminPassword = process.env.ADMIN_PASSWORD || "Tr030785";

  const db = new Client({ host, port, user, password, database });
  await db.connect();

  try {
    const r = await db.query(
      'select id, "companyId" from "Users" where email = $1 limit 1',
      [email]
    );
    if (r.rows.length === 0) {
      // seed se não existir
      // tenta executar o seed compilado (dist/scripts/seedLocalAdmin.js)
      const seedPath = path.resolve(__dirname, "./seedLocalAdmin.js");
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require(seedPath);
      console.log("[ensureAdmin] Seed executado, admin criado.");
      return;
    }

    // garante hash de senha
    const hash = bcrypt.hashSync(adminPassword, 10);
    await db.query('update "Users" set "passwordHash" = $1 where email = $2', [
      hash,
      email
    ]);
    console.log("[ensureAdmin] Senha do admin garantida/atualizada.");
  } finally {
    await db.end();
  }
}

main().catch(err => {
  console.error("[ensureAdmin] erro:", err?.message || err);
  process.exit(1);
});
