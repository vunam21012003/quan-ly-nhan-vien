import { Request } from "express";
import { pool } from "../db";

async function getUserScope(req: Request): Promise<{
  employeeId: number | null;
  managedDepartmentIds: number[];
  role: "admin" | "manager" | "employee";
}> {
  const user = (req as any).user;
  const [[me]]: any = await pool.query(
    "SELECT nhan_vien_id AS employeeId FROM tai_khoan WHERE id = ?",
    [user.id]
  );

  let managedDepartmentIds: number[] = [];
  if (user.role === "manager") {
    const [rows]: any = await pool.query("SELECT id FROM phong_ban WHERE manager_taikhoan_id = ?", [
      user.id,
    ]);
    managedDepartmentIds = rows.map((r: any) => r.id);
  }

  return {
    employeeId: me?.employeeId ?? null,
    managedDepartmentIds,
    role: user.role,
  };
}

export const getAll = async (req: Request) => {
  const { employeeId, managedDepartmentIds, role } = await getUserScope(req);

  const whereParts: string[] = [];
  const params: any[] = [];

  if (role === "manager") {
    if (managedDepartmentIds.length === 0) return [];
    whereParts.push(`nv.phong_ban_id IN (${managedDepartmentIds.map(() => "?").join(",")})`);
    params.push(...managedDepartmentIds);
  } else if (role === "employee") {
    if (!employeeId) return [];
    whereParts.push(`hd.nhan_vien_id = ?`);
    params.push(employeeId);
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `
    SELECT hd.*, nv.ho_ten
    FROM hop_dong hd
    JOIN nhan_vien nv ON nv.id = hd.nhan_vien_id
    ${whereSql}
    ORDER BY hd.id DESC
  `,
    params
  );

  return rows;
};

export const getDetail = async (req: Request) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return null;

  const { employeeId, managedDepartmentIds, role } = await getUserScope(req);

  const whereParts: string[] = [`hd.id = ?`];
  const params: any[] = [id];

  if (role === "manager") {
    if (managedDepartmentIds.length === 0) return null;
    whereParts.push(`nv.phong_ban_id IN (${managedDepartmentIds.map(() => "?").join(",")})`);
    params.push(...managedDepartmentIds);
  } else if (role === "employee") {
    if (!employeeId) return null;
    whereParts.push(`hd.nhan_vien_id = ?`);
    params.push(employeeId);
  }

  const whereSql = `WHERE ${whereParts.join(" AND ")}`;

  const [rows]: any = await pool.query(
    `
    SELECT hd.*, nv.ho_ten
    FROM hop_dong hd
    JOIN nhan_vien nv ON nv.id = hd.nhan_vien_id
    ${whereSql}
  `,
    params
  );

  return rows[0] || null;
};

export const create = async (body: any) => {
  const {
    nhan_vien_id,
    so_hop_dong,
    loai_hop_dong,
    ngay_ky,
    ngay_bat_dau,
    ngay_ket_thuc,
    luong_thoa_thuan,
    ghi_chu,
    trang_thai,
  } = body;

  if (!nhan_vien_id || !so_hop_dong) {
    return { error: "nhan_vien_id, so_hop_dong là bắt buộc" };
  }

  const [r]: any = await pool.query(
    `INSERT INTO hop_dong
       (nhan_vien_id, so_hop_dong, loai_hop_dong, ngay_ky, ngay_bat_dau, ngay_ket_thuc,
        luong_thoa_thuan, ghi_chu, trang_thai)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      nhan_vien_id,
      so_hop_dong,
      loai_hop_dong || null,
      ngay_ky || null,
      ngay_bat_dau || null,
      ngay_ket_thuc || null,
      luong_thoa_thuan || 0,
      ghi_chu || null,
      trang_thai || null,
    ]
  );

  return { data: { id: r.insertId, message: "OK" } };
};

export const update = async (id: number, body: any) => {
  if (!Number.isFinite(id) || id <= 0) return null;

  const {
    nhan_vien_id,
    so_hop_dong,
    loai_hop_dong,
    ngay_ky,
    ngay_bat_dau,
    ngay_ket_thuc,
    luong_thoa_thuan,
    ghi_chu,
    trang_thai,
  } = body;

  const [r]: any = await pool.query(
    `UPDATE hop_dong SET
        nhan_vien_id=?, so_hop_dong=?, loai_hop_dong=?, ngay_ky=?, ngay_bat_dau=?, ngay_ket_thuc=?,
        luong_thoa_thuan=?, ghi_chu=?, trang_thai=?
     WHERE id=?`,
    [
      nhan_vien_id || null,
      so_hop_dong || null,
      loai_hop_dong || null,
      ngay_ky || null,
      ngay_bat_dau || null,
      ngay_ket_thuc || null,
      luong_thoa_thuan || 0,
      ghi_chu || null,
      trang_thai || null,
      id,
    ]
  );

  return r.affectedRows > 0;
};

export const remove = async (id: number) => {
  if (!Number.isFinite(id) || id <= 0) return false;
  const [r]: any = await pool.query(`DELETE FROM hop_dong WHERE id=?`, [id]);
  return r.affectedRows > 0;
};
