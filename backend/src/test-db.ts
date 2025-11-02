import mysql from "mysql2/promise";

(async () => {
  try {
    const pool = mysql.createPool({
      host: "127.0.0.1",
      user: "root",
      password: "123456789",
      database: "quan_ly_nhan_su",
      port: 3306,
    });
    const [rows] = await pool.query("SELECT 1 AS ok");
    console.log("✅ Kết nối MySQL thành công:", rows);
  } catch (err) {
    console.error("❌ Lỗi kết nối MySQL:", err);
  }
})();
