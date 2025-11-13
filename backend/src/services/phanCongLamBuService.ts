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
            pb.ten_phong_ban
        FROM nhan_vien nv
        LEFT JOIN phong_ban pb ON nv.phong_ban_id = pb.id
    `;
  const params = [];

  // Lọc theo phongBanId nếu nó KHÔNG phải là null
  if (phongBanId !== null) {
    query += ` WHERE nv.phong_ban_id = ?`;
    params.push(phongBanId);
  }

  query += ` ORDER BY nv.ho_ten ASC`;

  const [rows]: any = await pool.query(query, params);
  return { items: rows }; // Trả về dạng { items: [...] }
};

/** Lưu danh sách nhân viên được phân công làm bù */
export const saveForDate = async (ngay: string, nhanVienIds: number[]) => {
  await pool.query(`DELETE FROM phan_cong_lam_bu WHERE ngay = ?`, [ngay]);

  if (nhanVienIds.length > 0) {
    const values = nhanVienIds.map((id) => [ngay, id]);
    await pool.query(`INSERT INTO phan_cong_lam_bu (ngay, nhan_vien_id) VALUES ?`, [values]);
  }

  return { message: "Đã lưu danh sách phân công làm bù" };
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
