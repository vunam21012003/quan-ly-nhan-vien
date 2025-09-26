// knexfile.js
const path = require("path");
require("dotenv").config();

const base = {
  client: "mysql2",
  connection: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || process.env.DB_PASS || "",
    database: process.env.DB_NAME || "quan_ly_nhan_su",
    dateStrings: true,
  },
  pool: { min: 2, max: 10 },
  migrations: {
    tableName: "knex_migrations",
    directory: path.resolve(__dirname, "db/migrations"),
  },
  seeds: {
    directory: path.resolve(__dirname, "db/seeds"),
  },
};

module.exports = {
  development: base,
  production: base,
};
