// scripts/fix-passwords.js
/**
 * Re-hash các mật khẩu trong bảng tai_khoan nếu chưa phải bcrypt.
 * - KHÔNG đụng vào các dòng đã là bcrypt.
 * - Chạy một lần để “sửa” dữ liệu lịch sử.
 */
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
require("dotenv").config();

(async () => {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "quan_ly_nhan_su",
    waitForConnections: true,
    connectionLimit: 5,
  });

  const isBcrypt = (s) => typeof s === "string" && /^\$2[aby]\$\d{2}\$/.test(s);

  try {
    const [rows] = await pool.query(
      "SELECT id, ten_dang_nhap, TRIM(mat_khau) AS mat_khau FROM tai_khoan"
    );

    let fixed = 0;
    for (const r of rows) {
      const raw = String(r.mat_khau || "").trim();
      if (!raw) continue; // mật khẩu rỗng => bỏ qua
      if (isBcrypt(raw)) continue; // đã là bcrypt => bỏ qua

      // ❗ raw KHÔNG phải bcrypt (nhiều khả năng là plain-text hoặc hash khác)
      const newHash = await bcrypt.hash(raw, 10);
      await pool.execute("UPDATE tai_khoan SET mat_khau = ? WHERE id = ?", [newHash, r.id]);
      fixed++;
      console.log(`✔ Rehashed user #${r.id} (${r.ten_dang_nhap})`);
    }

    console.log(`Done. Rehashed ${fixed} account(s).`);
  } catch (e) {
    console.error("Fix error:", e);
  } finally {
    await pool.end();
  }
})();
