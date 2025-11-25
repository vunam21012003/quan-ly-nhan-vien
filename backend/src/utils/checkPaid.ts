//utils/checkPaid.ts
import { pool } from "../db";

export async function isSalaryLocked(nvId: number, thang: number, nam: number): Promise<boolean> {
  // ❗ 1) Kiểm tra đã THANH TOÁN
  const [[paid]]: any = await pool.query(
    `
      SELECT 1 FROM lich_su_tra_luong 
      WHERE nhan_vien_id = ?
        AND thang = ?
        AND nam = ?
        AND trang_thai = 'da_thanh_toan'
      LIMIT 1
    `,
    [nvId, thang, nam]
  );
  if (paid) return true;

  // ❗ 2) Kiểm tra đã DUYỆT LƯƠNG (khóa thưởng/phạt & phụ cấp)
  const [[approved]]: any = await pool.query(
    `
      SELECT 1 FROM luong
      WHERE nhan_vien_id = ?
        AND thang = ?
        AND nam = ?
        AND trang_thai_duyet = 'da_duyet'
      LIMIT 1
    `,
    [nvId, thang, nam]
  );

  return !!approved;
}
