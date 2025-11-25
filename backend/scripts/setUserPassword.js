const { Client } = require("pg");
const bcrypt = require("bcryptjs");

async function main() {
  const host = process.env.DB_HOST || "localhost";
  const port = Number(process.env.DB_PORT || 5432);
  const user = process.env.DB_USER || "trmultichat";
  const password = process.env.DB_PASS || "";
  const database = process.env.DB_NAME || "trmultichat";

  const email = process.env.TARGET_EMAIL;
  const plainPassword = process.env.TARGET_PASSWORD;

  if (!email || !plainPassword) {
    console.error("TARGET_EMAIL and TARGET_PASSWORD are required");
    process.exit(1);
  }

  const client = new Client({ host, port, user, password, database });
  await client.connect();

  try {
    const hash = bcrypt.hashSync(plainPassword, 10);
    const res = await client.query("update \"Users\" set \"passwordHash\" = $1 where lower(email)=lower($2)", [hash, email]);
    console.log("updated rows:", res.rowCount);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

