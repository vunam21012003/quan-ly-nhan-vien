// src/services/phongBanService.ts
import { pool } from "../db";

// Lấy danh sách phòng ban có phân trang + tìm kiếm
export const getAll = async (search: string, page: number, limit: number) => {
  const offset = (page - 1) * limit;

  let where = "";
  const params: any[] = [];
  if (search) {
    where = "WHERE pb.ten_phong_ban LIKE ?";
    params.push(`%${search}%`);
  }

  const [rows]: any = await pool.query(
    `SELECT 
        pb.id, 
        pb.ten_phong_ban,              
        pb.ten_phong_ban AS ten,       
        pb.mo_ta, 
        pb.manager_taikhoan_id,
        nv.ho_ten AS manager_name
     FROM phong_ban pb
     LEFT JOIN tai_khoan tk ON pb.manager_taikhoan_id = tk.id
     LEFT JOIN nhan_vien nv ON tk.nhan_vien_id = nv.id
     ${where}
     ORDER BY pb.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [[{ total }]]: any = await pool.query(
    `SELECT COUNT(*) as total FROM phong_ban pb ${where}`,
    params
  );

  return { items: rows, total };
};

// Tạo mới
export const create = async (ten_phong_ban: string, mo_ta?: string, managerId?: number | null) => {
  try {
    const [r]: any = await pool.query(
      `INSERT INTO phong_ban (ten_phong_ban, mo_ta, manager_taikhoan_id)
       VALUES (?, ?, ?)`,
      [ten_phong_ban, mo_ta || null, managerId ?? null]
    );
    return { ok: true, id: r.insertId };
  } catch (err: any) {
    // Trùng manager_taikhoan_id (tài khoản đã là trưởng phòng phòng khác)
    if (err.code === "ER_DUP_ENTRY") {
      return {
        ok: false,
        error: "Tài khoản này đã là trưởng phòng của phòng ban khác",
      };
    }
    // FK: manager_taikhoan_id không tồn tại trong tai_khoan
    if (err.code === "ER_NO_REFERENCED_ROW_2" || err.code === "ER_ROW_IS_REFERENCED_2") {
      return { ok: false, error: "Tài khoản trưởng phòng không hợp lệ" };
    }
    throw err;
  }
};

// Cập nhật
export const update = async (
  id: number,
  ten_phong_ban: string,
  mo_ta?: string,
  managerId?: number | null
) => {
  try {
    // Nếu có chọn trưởng phòng
    if (managerId) {
      const [[row]]: any = await pool.query(
        `
        SELECT nv.phong_ban_id
        FROM tai_khoan tk
        JOIN nhan_vien nv ON nv.id = tk.nhan_vien_id
        WHERE tk.id = ?
        LIMIT 1
        `,
        [managerId]
      );

      if (!row) {
        return { ok: false, error: "Tài khoản trưởng phòng không tồn tại" };
      }

      if (Number(row.phong_ban_id) !== Number(id)) {
        return {
          ok: false,
          error: "Nhân viên này không thuộc phòng ban này, không thể làm trưởng phòng",
        };
      }
    }

    const [r]: any = await pool.query(
      `UPDATE phong_ban
       SET ten_phong_ban = ?, mo_ta = ?, manager_taikhoan_id = ?
       WHERE id = ?`,
      [ten_phong_ban, mo_ta || null, managerId ?? null, id]
    );
    return { ok: r.affectedRows > 0 };
  } catch (err: any) {
    console.error("ERROR UPDATE phong_ban:", err);

    if (err.code === "ER_DUP_ENTRY") {
      return {
        ok: false,
        error: "Tài khoản này đã là trưởng phòng của phòng ban khác",
      };
    }
    if (err.code === "ER_NO_REFERENCED_ROW_2" || err.code === "ER_ROW_IS_REFERENCED_2") {
      return { ok: false, error: "Tài khoản trưởng phòng không hợp lệ" };
    }
    throw err;
  }
};
// Xoá
export const remove = async (id: number) => {
  if (isNaN(id) || id <= 0) {
    throw new Error("ID phòng ban không hợp lệ.");
  }

  const [r]: any = await pool.query(`DELETE FROM phong_ban WHERE id = ?`, [id]);
  return { ok: r.affectedRows > 0 };
};
