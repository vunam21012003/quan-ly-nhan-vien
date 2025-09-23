import { Request } from "express";
import { pool } from "../db";

async function getUserScope(req: Request) {
  const user = (req as any).user;
  const [[me]]: any = await pool.query(
    "SELECT nhan_vien_id AS employeeId FROM tai_khoan WHERE id = ?",
    [user.id]
  );
  const employeeId = me?.employeeId ?? null;

  let managedDepartmentIds: number[] = [];
  if (user.role === "manager") {
    const [rows]: any = await pool.query("SELECT id FROM phong_ban WHERE manager_taikhoan_id = ?", [
      user.id,
    ]);
    managedDepartmentIds = rows.map((r: any) => r.id);
  }

  return { employeeId, managedDepartmentIds, role: user.role };
}

export const getAll = async (req: Request) => {
  const user = (req as any).user;
  const { employeeId, managedDepartmentIds } = await getUserScope(req);

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

  const whereParts: string[] = [];
  const whereParams: any[] = [];

  if (q) {
    whereParts.push(
      `(nv.ho_ten LIKE ? OR nv.email LIKE ? OR pb.ten_phong_ban LIKE ? OR cv.ten_chuc_vu LIKE ?)`
    );
    whereParams.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }

  if (user.role === "manager") {
    if (!managedDepartmentIds.length) return { items: [], total: 0, page, limit };
    whereParts.push(`nv.phong_ban_id IN (${managedDepartmentIds.map(() => "?").join(",")})`);
    whereParams.push(...managedDepartmentIds);
  } else if (user.role === "employee") {
    if (!employeeId) return { items: [], total: 0, page, limit };
    whereParts.push(`nv.id = ?`);
    whereParams.push(employeeId);
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

  const [rows]: any = await pool.query(
    `
    SELECT nv.*, cv.ten_chuc_vu, pb.ten_phong_ban
    FROM nhan_vien nv
    LEFT JOIN chuc_vu cv ON cv.id = nv.chuc_vu_id
    LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
    ${whereSql}
    ORDER BY nv.id DESC
    LIMIT ? OFFSET ?
  `,
    [...whereParams, limit, offset]
  );

  const [[countRow]]: any = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM nhan_vien nv
    LEFT JOIN chuc_vu cv ON cv.id = nv.chuc_vu_id
    LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
    ${whereSql}
  `,
    whereParams
  );

  return { items: rows, total: countRow?.total || 0, page, limit };
};

export const getById = async (req: Request) => {
  const id = Number(req.params.id);
  const { employeeId, managedDepartmentIds, role } = await getUserScope(req);

  const whereParts = ["nv.id = ?"];
  const whereParams: any[] = [id];

  if (role === "manager") {
    if (!managedDepartmentIds.length) return null;
    whereParts.push(`nv.phong_ban_id IN (${managedDepartmentIds.map(() => "?").join(",")})`);
    whereParams.push(...managedDepartmentIds);
  } else if (role === "employee") {
    if (!employeeId) return null;
    whereParts.push(`nv.id = ?`);
    whereParams.push(employeeId);
  }

  const whereSql = `WHERE ${whereParts.join(" AND ")}`;

  const [[row]]: any = await pool.query(
    `
    SELECT nv.*, cv.ten_chuc_vu, pb.ten_phong_ban
    FROM nhan_vien nv
    LEFT JOIN chuc_vu cv ON cv.id = nv.chuc_vu_id
    LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
    ${whereSql}
    LIMIT 1
  `,
    whereParams
  );

  return row || null;
};

export const create = async (body: any) => {
  const {
    ho_ten,
    gioi_tinh,
    ngay_sinh,
    dia_chi,
    so_dien_thoai,
    email,
    phong_ban_id,
    chuc_vu_id,
    ngay_vao_lam,
    trang_thai,
  } = body || {};

  if (!ho_ten) return { error: "ho_ten là bắt buộc" };
  if (!gioi_tinh || !["Nam", "Nữ"].includes(gioi_tinh)) {
    return { error: "gioi_tinh phải là 'Nam' hoặc 'Nữ'" };
  }

  const [r]: any = await pool.query(
    `
    INSERT INTO nhan_vien
      (ho_ten, gioi_tinh, ngay_sinh, dia_chi, so_dien_thoai, email,
       phong_ban_id, chuc_vu_id, ngay_vao_lam, trang_thai)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      ho_ten,
      gioi_tinh,
      ngay_sinh || null,
      dia_chi || null,
      so_dien_thoai || null,
      email || null,
      phong_ban_id || null,
      chuc_vu_id || null,
      ngay_vao_lam || null,
      trang_thai || "hoat_dong",
    ]
  );

  return { id: r.insertId };
};

export const update = async (id: number, body: any) => {
  const {
    ho_ten,
    gioi_tinh,
    ngay_sinh,
    dia_chi,
    so_dien_thoai,
    email,
    phong_ban_id,
    chuc_vu_id,
    ngay_vao_lam,
    trang_thai,
  } = body || {};

  if (gioi_tinh && !["Nam", "Nữ"].includes(gioi_tinh)) {
    return { error: "gioi_tinh phải là 'Nam' hoặc 'Nữ'" };
  }

  const [r]: any = await pool.query(
    `
    UPDATE nhan_vien SET
      ho_ten=?, gioi_tinh=?, ngay_sinh=?, dia_chi=?, so_dien_thoai=?, email=?,
      phong_ban_id=?, chuc_vu_id=?, ngay_vao_lam=?, trang_thai=?
    WHERE id=?
  `,
    [
      ho_ten || null,
      gioi_tinh || null,
      ngay_sinh || null,
      dia_chi || null,
      so_dien_thoai || null,
      email || null,
      phong_ban_id || null,
      chuc_vu_id || null,
      ngay_vao_lam || null,
      trang_thai || null,
      id,
    ]
  );

  if (!r.affectedRows) return { error: "Không tìm thấy" };
  return { ok: true };
};

export const partialUpdate = async (id: number, body: any) => {
  const allowed: Record<string, string> = {
    ho_ten: "ho_ten",
    gioi_tinh: "gioi_tinh",
    ngay_sinh: "ngay_sinh",
    dia_chi: "dia_chi",
    so_dien_thoai: "so_dien_thoai",
    email: "email",
    phong_ban_id: "phong_ban_id",
    chuc_vu_id: "chuc_vu_id",
    ngay_vao_lam: "ngay_vao_lam",
    trang_thai: "trang_thai",
  };

  const sets: string[] = [];
  const params: any[] = [];

  for (const k in body) {
    if (!(k in allowed)) continue;
    const val = body[k];

    if (k === "gioi_tinh" && !["Nam", "Nữ"].includes(val)) {
      return { error: "gioi_tinh phải là 'Nam' hoặc 'Nữ'" };
    }

    sets.push(`${allowed[k]} = ?`);
    params.push(val);
  }

  if (!sets.length) return { error: "Không có trường nào để cập nhật" };

  const sql = `UPDATE nhan_vien SET ${sets.join(", ")} WHERE id = ?`;
  params.push(id);
  const [r]: any = await pool.query(sql, params);

  if (!r.affectedRows) return { error: "Không tìm thấy" };
  return { changed: r.changedRows || sets.length };
};

export const remove = async (id: number, force = false) => {
  if (!Number.isFinite(id) || id <= 0) return { error: "ID không hợp lệ" };

  if (!force) {
    const [r]: any = await pool.query("DELETE FROM nhan_vien WHERE id = ?", [id]);
    if (!r.affectedRows) return { error: "Không tìm thấy nhân viên để xóa" };
    return { message: "Đã xóa nhân viên" };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const tables = ["cham_cong", "phan_tich_cong", "hop_dong", "lich_su_tra_luong", "luong"];
    for (const t of tables) {
      try {
        await conn.query(`DELETE FROM ${t} WHERE nhan_vien_id = ?`, [id]);
      } catch (err: any) {
        const msg = String(err?.message || "");
        if (!/doesn't exist|unknown table|unknown column/i.test(msg)) throw err;
      }
    }

    const [r]: any = await conn.query("DELETE FROM nhan_vien WHERE id = ?", [id]);
    if (!r.affectedRows) {
      await conn.rollback();
      return { status: 404, error: "Không tìm thấy nhân viên để xóa" };
    }

    await conn.commit();
    return { message: "Đã xóa (force)" };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};
