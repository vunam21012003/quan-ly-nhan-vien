// backend/scripts/hash-passwords.js
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
require("dotenv").config(); // dùng .env của bạn ở backend/.env

(async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "quan_ly_nhan_su",
    waitForConnections: true,
    connectionLimit: 5,
  });

  try {
    const [rows] = await pool.query("SELECT id, mat_khau FROM tai_khoan");
    let updated = 0;
    for (const r of rows) {
      const id = r.id;
      const pw = String(r.mat_khau || "").trim();
      if (!pw) continue;
      // Nếu đã là bcrypt hash (ví dụ bắt đầu bằng $2a$ $2b$ $2y$) thì bỏ qua
      if (/^\$2[aby]\$/.test(pw)) continue;
      const newHash = await bcrypt.hash(pw, 10);
      await pool.query("UPDATE tai_khoan SET mat_khau = ? WHERE id = ?", [newHash, id]);
      console.log(`=> Updated id=${id}`);
      updated++;
    }
    console.log(`Done. Updated ${updated} account(s).`);
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
