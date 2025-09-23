import { Request } from "express";
import { pool } from "../db";

async function getUserScope(req: Request) {
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
  const thang = Number(req.query.thang);
  const nam = Number(req.query.nam);
  const nhan_vien_id = Number(req.query.nhan_vien_id);

  const where: string[] = [];
  const params: any[] = [];

  if (Number.isInteger(thang)) {
    where.push("pt.thang = ?");
    params.push(thang);
  }

  if (Number.isInteger(nam)) {
    where.push("pt.nam = ?");
    params.push(nam);
  }

  if (role === "manager") {
    if (!managedDepartmentIds.length) return [];
    where.push(`nv.phong_ban_id IN (${managedDepartmentIds.map(() => "?").join(",")})`);
    params.push(...managedDepartmentIds);
  } else if (role === "employee") {
    if (!employeeId) return [];
    where.push("pt.nhan_vien_id = ?");
    params.push(employeeId);
  } else {
    if (Number.isInteger(nhan_vien_id)) {
      where.push("pt.nhan_vien_id = ?");
      params.push(nhan_vien_id);
    }
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `
    SELECT pt.*, nv.ho_ten
    FROM phan_tich_cong pt
    JOIN nhan_vien nv ON nv.id = pt.nhan_vien_id
    ${whereSql}
    ORDER BY pt.nam DESC, pt.thang DESC, pt.id DESC
  `,
    params
  );

  return rows;
};

export const create = async (req: Request) => {
  const {
    nhan_vien_id,
    thang,
    nam,
    tong_gio,
    gio_ngay_thuong,
    gio_ngay_nghi,
    gio_tang_ca,
    so_ngay_cong,
    so_ngay_nghi,
    ghi_chu,
  } = req.body || {};

  if (!nhan_vien_id || !thang || !nam) {
    return { error: "nhan_vien_id, thang, nam là bắt buộc" };
  }

  const { role, managedDepartmentIds } = await getUserScope(req);

  if (role === "manager") {
    const [rows]: any = await pool.query(
      `SELECT id FROM nhan_vien WHERE id = ? AND phong_ban_id IN (${managedDepartmentIds.map(() => "?").join(",")})`,
      [nhan_vien_id, ...managedDepartmentIds]
    );
    if (!rows.length) {
      return { status: 403, error: "Không có quyền thêm cho nhân viên này" };
    }
  }

  const [r]: any = await pool.query(
    `
    INSERT INTO phan_tich_cong
      (nhan_vien_id, thang, nam, tong_gio, gio_ngay_thuong, gio_ngay_nghi,
       gio_tang_ca, so_ngay_cong, so_ngay_nghi, ghi_chu)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      nhan_vien_id,
      thang,
      nam,
      tong_gio || 0,
      gio_ngay_thuong || 0,
      gio_ngay_nghi || 0,
      gio_tang_ca || 0,
      so_ngay_cong || 0,
      so_ngay_nghi || 0,
      ghi_chu || null,
    ]
  );

  return { id: r.insertId };
};
