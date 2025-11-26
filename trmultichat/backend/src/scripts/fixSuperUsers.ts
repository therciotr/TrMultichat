import { getSequelize } from "../utils/legacyModel";

async function main() {
  const sequelize = getSequelize();
  if (!sequelize || typeof sequelize.query !== "function") {
    // eslint-disable-next-line no-console
    console.error("Sequelize not available");
    process.exit(1);
  }

  const masterCompanyId = Number(process.env.MASTER_COMPANY_ID || 1);

  await sequelize.query(
    'UPDATE "Users" SET "super" = false WHERE "companyId" <> :cid',
    {
      replacements: { cid: masterCompanyId }
    }
  );

  const masterEmail = process.env.MASTER_EMAIL;
  if (masterEmail) {
    await sequelize.query(
      'UPDATE "Users" SET "super" = true WHERE lower(email) = lower(:email)',
      { replacements: { email: masterEmail } }
    );
  }

  // eslint-disable-next-line no-console
  console.log("fixSuperUsers done");
  process.exit(0);
}

main().catch(e => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
