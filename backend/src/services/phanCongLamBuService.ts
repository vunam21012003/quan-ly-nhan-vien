//phanCongLamBuService
import { pool } from "../db";

/** Lấy danh sách nhân viên được phân công làm bù cho 1 ngày */
export const getByDate = async (ngay: string) => {
  const [rows]: any = await pool.query(
    `SELECT pclb.*, nv.ho_ten, pb.ten_phong_ban, cv.ten_chuc_vu
     FROM phan_cong_lam_bu pclb
     JOIN nhan_vien nv ON pclb.nhan_vien_id = nv.id
     LEFT JOIN phong_ban pb ON nv.phong_ban_id = pb.id
     LEFT JOIN chuc_vu cv ON nv.chuc_vu_id = cv.id
     WHERE pclb.ngay = ?
     ORDER BY nv.ho_ten ASC`,
    [ngay]
  );
  return rows;
};

/** 💡 Lấy danh sách nhân viên. Nếu phongBanId là NULL (cho Admin), lấy tất cả. */
export const getNhanVienChoPhanCong = async (phongBanId: number | null) => {
  let query = `
      SELECT 
          nv.id, nv.ho_ten, 
          pb.ten_phong_ban,
          nv.phong_ban_id
      FROM nhan_vien nv
      LEFT JOIN phong_ban pb ON nv.phong_ban_id = pb.id
  `;
  const params = [];

  // Manager phòng khác → lọc theo phòng ban
  if (phongBanId !== null) {
    query += ` WHERE nv.phong_ban_id = ?`;
    params.push(phongBanId);
  }

  query += ` ORDER BY nv.ho_ten ASC`;

  const [rows]: any = await pool.query(query, params);
  return { items: rows };
};

/** Lưu danh sách nhân viên được phân công làm bù */
export const saveForDate = async (
  ngay: string,
  nhanVienIds: number[],
  phongBanId: number | null
) => {
  nhanVienIds = nhanVienIds.map((id) => Number(id));

  // Danh sách phân công cũ
  const [rows]: any = await pool.query(
    `SELECT pclb.nhan_vien_id, nv.phong_ban_id
     FROM phan_cong_lam_bu pclb
     JOIN nhan_vien nv ON pclb.nhan_vien_id = nv.id
     WHERE pclb.ngay = ?`,
    [ngay]
  );

  const existedIds: number[] = rows.map((r: any) => Number(r.nhan_vien_id));

  // Người cần thêm
  const needInsert = nhanVienIds.filter((id) => !existedIds.includes(id));

  // Người cần xoá
  let needDelete: number[] = [];

  if (phongBanId === null) {
    // Admin + KT → xoá mọi người
    needDelete = existedIds.filter((id) => !nhanVienIds.includes(id));
  } else {
    // Manager phòng khác → chỉ xoá nhân viên trong phòng ban họ
    needDelete = rows
      .filter((r: any) => r.phong_ban_id === phongBanId && !nhanVienIds.includes(r.nhan_vien_id))
      .map((r: any) => Number(r.nhan_vien_id));
  }

  // INSERT
  if (needInsert.length > 0) {
    const values = needInsert.map((id) => [ngay, id]);
    await pool.query(`INSERT INTO phan_cong_lam_bu (ngay, nhan_vien_id) VALUES ?`, [values]);
  }

  // DELETE
  if (needDelete.length > 0) {
    const placeholders = needDelete.map(() => "?").join(",");
    await pool.query(
      `DELETE FROM phan_cong_lam_bu 
       WHERE ngay = ? AND nhan_vien_id IN (${placeholders})
      `,
      [ngay, ...needDelete]
    );
  }

  return {
    message: "Đã lưu phân công làm bù.",
    added: needInsert.length,
    deleted: needDelete.length,
  };
};

/** Kiểm tra xem nhân viên có nằm trong danh sách làm bù của ngày không */
export const isLamBu = async (nhan_vien_id: number, ngay: string): Promise<boolean> => {
  // 🔧 Chuẩn hóa ngày về dạng YYYY-MM-DD
  const d = new Date(ngay);
  if (isNaN(d.getTime())) return false;
  const ngaySql = d.toISOString().slice(0, 10);

  const [[r]]: any = await pool.query(
    "SELECT COUNT(*) AS c FROM phan_cong_lam_bu WHERE nhan_vien_id = ? AND ngay = ?",
    [nhan_vien_id, ngaySql]
  );
  return r?.c > 0;
};
