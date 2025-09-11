import mysql from "mysql2/promise";
import "dotenv/config";

export const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  // Hỗ trợ cả DB_PASSWORD và DB_PASS
  password: process.env.DB_PASSWORD || process.env.DB_PASS || "",
  database: process.env.DB_NAME || "quan_ly_nhan_su",
  waitForConnections: true,
  connectionLimit: 10,
  // (tuỳ chọn) tránh lỗi timezone/charset
  // dateStrings: true,
  // charset: "utf8mb4_general_ci",
});
