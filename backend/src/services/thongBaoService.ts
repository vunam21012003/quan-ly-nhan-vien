//thongBaoService.ts
import { pool } from "../db";

// Thêm hàm lấy số lượng thông báo chưa đọc
export const demSoThongBaoChuaDoc = async (nguoi_nhan_id: number) => {
  const [rows]: any = await pool.query(
    `
    SELECT COUNT(id) AS total
    FROM thong_bao
    WHERE (nguoi_nhan_id = ? OR nguoi_nhan_id IS NULL)
      AND trang_thai = 'chua_doc'
    `,
    [nguoi_nhan_id]
  );
  return rows[0].total;
};

// Cập nhật hàm lấy thông báo để ưu tiên các thông báo chưa đọc
export const layTheoNguoi = async (nguoi_nhan_id: number) => {
  const [rows]: any = await pool.query(
    `
    SELECT 
          id, nguoi_nhan_id, loai, tieu_de, noi_dung, tham_chieu_loai, tham_chieu_id, nguoi_tao_id, created_at, trang_thai
    FROM thong_bao
    WHERE (nguoi_nhan_id = ? OR nguoi_nhan_id IS NULL)
          -- Lấy 5 thông báo chưa đọc gần nhất, sau đó lấy thêm 5 thông báo đã đọc
    ORDER BY trang_thai ASC, created_at DESC 
    LIMIT 10
    `,
    [nguoi_nhan_id]
  );

  return rows;
};

export const tao = async (body: any) => {
  const { nguoi_nhan_id, loai, tieu_de, noi_dung, tham_chieu_loai, tham_chieu_id, nguoi_tao_id } =
    body;

  const [r]: any = await pool.query(
    `
    INSERT INTO thong_bao
    (nguoi_nhan_id, loai, tieu_de, noi_dung, tham_chieu_loai, tham_chieu_id, nguoi_tao_id, trang_thai)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'chua_doc') -- Mặc định là chưa đọc
    `,
    [
      nguoi_nhan_id || null,
      loai,
      tieu_de,
      noi_dung || null,
      tham_chieu_loai || null,
      tham_chieu_id || null,
      nguoi_tao_id || null,
    ]
  );

  return { id: r.insertId };
};

export const danhDauDaDoc = async (id: number) => {
  await pool.query(
    `
    UPDATE thong_bao SET trang_thai = 'da_doc'
    WHERE id = ?
  `,
    [id]
  );
  return { ok: true };
};

export const xoa = async (id: number) => {
  await pool.query(`DELETE FROM thong_bao WHERE id = ?`, [id]);
  return { message: "Đã xóa thông báo" };
};
