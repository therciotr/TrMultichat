import dotenv from "dotenv";
import bcrypt from "bcryptjs";
dotenv.config();

async function run() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sequelize = (require("../database").default || require("../database"));
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const CompanyModel = require("../models/Company");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const UserModel = require("../models/User");

  const Company = CompanyModel.default || CompanyModel;
  const User = UserModel.default || UserModel;

  await sequelize.authenticate();

  const adminTenantName = process.env.ADMIN_TENANT_NAME || "TR TECNOLOGIAS";
  const adminName = process.env.ADMIN_NAME || "TR Admin";
  const adminEmail = process.env.ADMIN_EMAIL || "thercio@trtecnologias.com.br";
  const adminPassword = process.env.ADMIN_PASSWORD || "Tr030785";

  const [company] = await Company.findOrCreate({
    where: { name: adminTenantName },
    defaults: { name: adminTenantName, status: true }
  });

  const hash = bcrypt.hashSync(adminPassword, 10);

  const [user] = await User.findOrCreate({
    where: { email: adminEmail },
    defaults: {
      name: adminName,
      email: adminEmail,
      passwordHash: hash,
      companyId: company.id,
      admin: true,
      online: false
    }
  });

  if (user) {
    await user.update({ companyId: company.id, admin: true, passwordHash: hash });
  }

  // eslint-disable-next-line no-console
  console.log("Seed completed:");
  // eslint-disable-next-line no-console
  console.log("Tenant:", company.id, company.name);
  // eslint-disable-next-line no-console
  console.log("User:", user.email);
}

run().then(() => process.exit(0)).catch(err => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});


