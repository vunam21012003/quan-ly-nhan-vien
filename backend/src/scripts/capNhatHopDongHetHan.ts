/**
 * Tác vụ tự động cập nhật trạng thái hợp đồng đã hết hạn
 * --------------------------------------------------------
 * - Cập nhật tất cả hợp đồng có ngày_ket_thuc < ngày hiện tại
 *   và trạng_thai = 'con_hieu_luc' → chuyển thành 'het_han'
 */

import { pool } from "../db";

async function capNhatHopDongHetHan() {
  console.log("🔄 Đang kiểm tra và cập nhật trạng thái hợp đồng...");

  try {
    const [result]: any = await pool.query(`
      UPDATE hop_dong
      SET trang_thai = 'het_han'
      WHERE trang_thai = 'con_hieu_luc'
        AND ngay_ket_thuc IS NOT NULL
        AND ngay_ket_thuc < CURDATE()
    `);

    console.log(`✅ Đã cập nhật ${result.affectedRows} hợp đồng hết hạn.`);
  } catch (err) {
    console.error("❌ Lỗi khi cập nhật hợp đồng hết hạn:", err);
  } finally {
    // ❌ KHÔNG được đóng pool ở đây
    // await pool.end();
  }
}

// Gọi hàm khi chạy file
capNhatHopDongHetHan();
