// scripts/reset-one-password.js
/**
 * Đặt lại mật khẩu cho 1 user cụ thể (bằng username).
 * Cách dùng: node scripts/reset-one-password.js username newpassword
 */
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
require("dotenv").config();

(async () => {
  const [, , username, newPassword] = process.argv;
  if (!username || !newPassword) {
    console.error("Cách dùng: node scripts/reset-one-password.js <username> <newPassword>");
    process.exit(1);
  }

  const pool = await mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "quan_ly_nhan_su",
  });

  try {
    const [rows] = await pool.query("SELECT id FROM tai_khoan WHERE ten_dang_nhap = ? LIMIT 1", [
      username,
    ]);
    const user = (rows || [])[0];
    if (!user) {
      console.error("Không tìm thấy user:", username);
      process.exit(1);
    }

    const hash = await bcrypt.hash(String(newPassword).trim(), 10);
    await pool.execute("UPDATE tai_khoan SET mat_khau = ? WHERE id = ?", [hash, user.id]);
    console.log(`✔ Đã đặt lại mật khẩu cho ${username}`);
  } catch (e) {
    console.error("Reset error:", e);
  } finally {
    await pool.end();
  }
})();
