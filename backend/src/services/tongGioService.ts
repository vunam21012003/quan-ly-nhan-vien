import { pool } from "../db";

/**
 * Cập nhật tổng giờ làm và tổng điểm công cho từng nhân viên theo tháng
 * (Dựa trên toàn bộ dữ liệu bảng cham_cong)
 */
export async function capNhatTongGioLam(nhan_vien_id: number, ngay_lam: string) {
  if (!nhan_vien_id || !ngay_lam) return;

  try {
    console.log("🟢 BẮT ĐẦU capNhatTongGioLam:", { nhan_vien_id, ngay_lam });

    // --- Xác định tháng-năm (vd: 2025-10)
    const date = new Date(ngay_lam);
    const thang_nam = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    // --- Lấy toàn bộ bản ghi chấm công của nhân viên trong tháng
    const [records]: any = await pool.query(
      `SELECT DISTINCT ngay_lam, gio_vao, gio_ra, trang_thai, tong_gio, ghi_chu
       FROM cham_cong
       WHERE nhan_vien_id = ? AND LEFT(ngay_lam, 7) = ?`,
      [nhan_vien_id, thang_nam]
    );

    // --- Nếu không còn bản ghi nào => xoá dòng tổng giờ
    if (!records.length) {
      console.log(`🗑️ Không còn dữ liệu chấm công của NV ${nhan_vien_id} trong tháng ${thang_nam}`);
      await pool.query(`DELETE FROM tong_gio_lam WHERE nhan_vien_id=? AND thang_nam=?`, [
        nhan_vien_id,
        thang_nam,
      ]);
      return;
    }

    // --- Biến tổng hợp ---
    let gio_ngay_thuong = 0;
    let gio_ngay_le = 0;
    let gio_tang_ca = 0;
    let gio_ca_dem = 0;
    let tong_diem_cong = 0;

    // --- Giờ nghỉ trưa chuẩn (12h - 13h)
    const LUNCH_START = 12 * 60;
    const LUNCH_END = 13 * 60;

    for (const rec of records) {
      const { gio_vao, gio_ra, trang_thai, ngay_lam } = rec;
      if (!gio_vao || !gio_ra) continue;

      // --- Kiểm tra ngày lễ ---
      const [[holiday]]: any = await pool.query(
        `SELECT he_so_luong, diem_cong FROM ngay_le WHERE ngay = ?`,
        [ngay_lam]
      );
      const isHoliday = Boolean(holiday);
      const he_so_ngay_le = isHoliday ? Number(holiday.he_so_luong || 2.5) : 1;
      const diem_cong_ngay_le = isHoliday ? Number(holiday.diem_cong || 1) : 1;

      // --- Phân tích giờ vào/ra ---
      const [vaoH, vaoM] = gio_vao.split(":").map(Number);
      const [raH, raM] = gio_ra.split(":").map(Number);
      const vaoPhut = vaoH * 60 + vaoM;
      const raPhut = raH * 60 + raM;

      // --- Tính tổng giờ làm trong ngày (trừ nghỉ trưa nếu có) ---
      let diff = (raPhut - vaoPhut) / 60;
      if (vaoPhut < LUNCH_END && raPhut > LUNCH_START) {
        const overlapStart = Math.max(vaoPhut, LUNCH_START);
        const overlapEnd = Math.min(raPhut, LUNCH_END);
        const lunchOverlap = Math.max(0, overlapEnd - overlapStart);
        diff -= lunchOverlap / 60;
      }

      // --- Tính điểm công ---
      let diem_cong = 0;
      if (isHoliday || trang_thai === "ngay_le") {
        diem_cong = diem_cong_ngay_le;
      } else {
        switch (trang_thai) {
          case "di_lam":
            diem_cong = 1;
            break;
          case "di_muon":
          case "ve_som":
            diem_cong = 0.75;
            break;
          case "di_muon_ve_som":
            diem_cong = 0.5;
            break;
          default:
            diem_cong = 0;
            break;
        }
      }
      tong_diem_cong += diem_cong;

      // --- Phân loại giờ ---
      if (isHoliday || trang_thai === "ngay_le") {
        // Giờ lễ nhân hệ số
        gio_ngay_le += diff * he_so_ngay_le;
      } else if (raPhut >= 22 * 60 || vaoPhut < 6 * 60) {
        gio_ca_dem += diff;
      } else if (raPhut > 17 * 60 + 5) {
        const tangCa = (raPhut - (17 * 60 + 5)) / 60;
        gio_tang_ca += tangCa;
        gio_ngay_thuong += diff - tangCa;
      } else {
        gio_ngay_thuong += diff;
      }
    }

    // --- Tổng giờ sau khi đã phân loại ---
    const tong_gio = gio_ngay_thuong + gio_ngay_le + gio_tang_ca + gio_ca_dem;

    // --- Kiểm tra xem đã có dòng trong tong_gio_lam chưa ---
    const [exist]: any = await pool.query(
      "SELECT id FROM tong_gio_lam WHERE nhan_vien_id=? AND thang_nam=?",
      [nhan_vien_id, thang_nam]
    );

    if (exist.length > 0) {
      await pool.query(
        `UPDATE tong_gio_lam 
         SET gio_ngay_thuong=?, gio_ngay_le=?, gio_tang_ca=?, gio_ca_dem=?, tong_gio=?, tong_diem_cong=?, updated_at=NOW()
         WHERE id=?`,
        [
          gio_ngay_thuong,
          gio_ngay_le,
          gio_tang_ca,
          gio_ca_dem,
          tong_gio,
          tong_diem_cong,
          exist[0].id,
        ]
      );
      console.log(`🔁 Cập nhật tổng giờ & công NV ${nhan_vien_id} (${thang_nam})`);
    } else {
      await pool.query(
        `INSERT INTO tong_gio_lam 
         (nhan_vien_id, thang_nam, gio_ngay_thuong, gio_ngay_le, gio_tang_ca, gio_ca_dem, tong_gio, tong_diem_cong, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          nhan_vien_id,
          thang_nam,
          gio_ngay_thuong,
          gio_ngay_le,
          gio_tang_ca,
          gio_ca_dem,
          tong_gio,
          tong_diem_cong,
        ]
      );
      console.log(`🆕 Thêm mới tổng giờ & công NV ${nhan_vien_id} (${thang_nam})`);
    }
  } catch (err) {
    console.error("❌ LỖI TRONG capNhatTongGioLam:", err);
  }
}
