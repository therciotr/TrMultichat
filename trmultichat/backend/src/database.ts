/* Bridge para a instância Sequelize já compilada em dist/database.
 * Isso permite que o código TypeScript (ts-node-dev) use a mesma
 * configuração de banco que o backend em produção/dev.
 */

/* eslint-disable @typescript-eslint/no-var-requires, import/extensions, import/no-unresolved */

const path = require("path");

// Resolve sempre para o módulo compilado em dist/database
// (que lê process.env.DB_* através de dist/config/database.js)
const db =
  require(path.resolve(process.cwd(), "dist", "database")) ||
  require("../dist/database");

export default db;
module.exports = db;


