import { pool } from "../db";

export const autoCopyAllowance = async () => {
  const now = new Date();
  const thang = now.getMonth() + 1;
  const nam = now.getFullYear();

  // Tháng trước
  let prevThang = thang - 1;
  let prevNam = nam;

  if (prevThang === 0) {
    prevThang = 12;
    prevNam--;
  }

  // Lấy phụ cấp tháng trước (chỉ loại theo tháng)
  const [rows]: any = await pool.query(
    `
    SELECT *
    FROM phu_cap_chi_tiet pct
    JOIN phu_cap_loai pc ON pc.id = pct.loai_id
    WHERE pc.is_fixed = 0
      AND pct.thang = ?
      AND pct.nam = ?
  `,
    [prevThang, prevNam]
  );

  if (rows.length === 0) return { copied: 0 };

  // Lọc ra những bản chưa tồn tại tháng này
  const values = [];

  for (const item of rows) {
    const [exist]: any = await pool.query(
      `
      SELECT id FROM phu_cap_chi_tiet
      WHERE nhan_vien_id = ?
        AND loai_id = ?
        AND thang = ?
        AND nam = ?
    `,
      [item.nhan_vien_id, item.loai_id, thang, nam]
    );

    if (exist.length === 0) {
      values.push([
        item.nhan_vien_id,
        null, // hop_dong_id
        item.loai_id,
        thang,
        nam,
        item.so_tien,
        "(Tự động copy từ tháng trước)",
      ]);
    }
  }

  if (values.length > 0) {
    await pool.query(
      `
      INSERT INTO phu_cap_chi_tiet
      (nhan_vien_id, hop_dong_id, loai_id, thang, nam, so_tien, ghi_chu)
      VALUES ?
    `,
      [values]
    );
  }

  return { copied: values.length };
};
