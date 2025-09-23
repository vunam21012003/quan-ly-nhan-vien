import { pool } from "../db";
import { Request } from "express";

function buildCommonFilters(req: Request) {
  const page = Math.max(parseInt(String(req.query.page ?? "1"), 10), 1);
  const limit = Math.max(parseInt(String(req.query.limit ?? "20"), 10), 1);
  const offset = (page - 1) * limit;

  const thang = req.query.thang !== undefined ? parseInt(String(req.query.thang), 10) : undefined;
  const nam = req.query.nam !== undefined ? parseInt(String(req.query.nam), 10) : undefined;
  const nhan_vien_id =
    req.query.nhan_vien_id !== undefined ? parseInt(String(req.query.nhan_vien_id), 10) : undefined;
  const q = (req.query.q as string | undefined)?.trim();

  const where: string[] = [];
  const params: any[] = [];

  if (!Number.isNaN(thang)) {
    where.push("l.thang = ?");
    params.push(thang);
  }
  if (!Number.isNaN(nam)) {
    where.push("l.nam = ?");
    params.push(nam);
  }
  if (!Number.isNaN(nhan_vien_id)) {
    where.push("l.nhan_vien_id = ?");
    params.push(nhan_vien_id);
  }
  if (q) {
    where.push("nv.ho_ten LIKE ?");
    params.push(`%${q}%`);
  }

  return { page, limit, offset, where, params };
}

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

  return { employeeId, managedDepartmentIds, role: user.role, userId: user.id };
}

export const getAll = async (req: Request) => {
  const user = (req as any).user;
  const { page, limit, offset, where, params } = buildCommonFilters(req);

  if (user.role === "manager") {
    where.push("pb.manager_taikhoan_id = ?");
    params.push(user.id);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countSql = `
    SELECT COUNT(*) AS total
    FROM luong l
    JOIN nhan_vien nv ON nv.id = l.nhan_vien_id
    LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
    ${whereSql}
  `;
  const [countRows] = await pool.query(countSql, params);
  const total = (countRows as any[])[0]?.total ?? 0;

  const dataSql = `
    SELECT l.*, nv.ho_ten
    FROM luong l
    JOIN nhan_vien nv ON nv.id = l.nhan_vien_id
    LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
    ${whereSql}
    ORDER BY l.nam DESC, l.thang DESC, l.id DESC
    LIMIT ? OFFSET ?
  `;
  const dataParams = [...params, limit, offset];
  const [rows] = await pool.query(dataSql, dataParams);

  return { page, limit, total, items: rows };
};

export const getMine = async (req: Request) => {
  const user = (req as any).user;
  const page = Math.max(parseInt(String(req.query.page ?? "1"), 10), 1);
  const limit = Math.max(parseInt(String(req.query.limit ?? "50"), 10), 1);
  const offset = (page - 1) * limit;

  const thang = req.query.thang ? parseInt(String(req.query.thang), 10) : undefined;
  const nam = req.query.nam ? parseInt(String(req.query.nam), 10) : undefined;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;

  const where: string[] = ["tk.id = ?"];
  const params: any[] = [user.id];

  if (!Number.isNaN(thang)) {
    where.push("l.thang = ?");
    params.push(thang);
  }
  if (!Number.isNaN(nam)) {
    where.push("l.nam = ?");
    params.push(nam);
  }
  if (q) {
    where.push("nv.ho_ten LIKE ?");
    params.push(`%${q}%`);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;

  const countSql = `
    SELECT COUNT(*) AS total
    FROM luong l
    JOIN nhan_vien nv ON nv.id = l.nhan_vien_id
    JOIN tai_khoan tk ON tk.nhan_vien_id = nv.id
    ${whereSql}
  `;
  const [countRows] = await pool.query(countSql, params);
  const total = (countRows as any[])[0]?.total ?? 0;

  const dataSql = `
    SELECT l.*, nv.ho_ten
    FROM luong l
    JOIN nhan_vien nv ON nv.id = l.nhan_vien_id
    JOIN tai_khoan tk ON tk.nhan_vien_id = nv.id
    ${whereSql}
    ORDER BY l.nam DESC, l.thang DESC, l.id DESC
    LIMIT ? OFFSET ?
  `;
  const dataParams = [...params, limit, offset];
  const [rows] = await pool.query(dataSql, dataParams);

  return { page, limit, total, items: rows };
};

export const getById = async (req: Request) => {
  const { employeeId, managedDepartmentIds, role } = await getUserScope(req);
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return null;

  const whereParts: string[] = ["l.id = ?"];
  const params: any[] = [id];

  if (role === "manager") {
    if (!managedDepartmentIds.length) return null;
    whereParts.push(`nv.phong_ban_id IN (${managedDepartmentIds.map(() => "?").join(",")})`);
    params.push(...managedDepartmentIds);
  } else if (role === "employee") {
    if (!employeeId) return null;
    whereParts.push("l.nhan_vien_id = ?");
    params.push(employeeId);
  }

  const whereSql = `WHERE ${whereParts.join(" AND ")}`;

  const sql = `
    SELECT l.*, nv.ho_ten, pb.ten_phong_ban
    FROM luong l
    JOIN nhan_vien nv ON nv.id = l.nhan_vien_id
    LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
    ${whereSql}
    LIMIT 1
  `;
  const [[row]]: any = await pool.query(sql, params);
  return row || null;
};

export const create = async (body: any) => {
  const { nhan_vien_id, thang, nam, luong_co_ban, phu_cap, thuong, khau_tru } = body;
  if (!nhan_vien_id || !thang || !nam || luong_co_ban === undefined || luong_co_ban === null) {
    return { error: "nhan_vien_id, thang, nam, luong_co_ban là bắt buộc" };
  }

  const insertSql = `
    INSERT INTO luong (nhan_vien_id, thang, nam, luong_co_ban, phu_cap, thuong, khau_tru)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  const [result] = await pool.execute(insertSql, [
    nhan_vien_id,
    thang,
    nam,
    luong_co_ban,
    phu_cap ?? 0,
    thuong ?? 0,
    khau_tru ?? 0,
  ]);

  return { id: (result as any).insertId };
};

export const update = async (id: number, body: any) => {
  const allowed = ["nhan_vien_id", "thang", "nam", "luong_co_ban", "phu_cap", "thuong", "khau_tru"];
  const fields = allowed.filter((k) => body[k] !== undefined);
  if (!fields.length) return { error: "Không có trường nào để cập nhật" };

  const sets = fields.map((k) => `${k} = ?`).join(", ");
  const values = fields.map((k) => body[k]);

  const sql = `UPDATE luong SET ${sets} WHERE id = ?`;
  await pool.execute(sql, [...values, id]);

  return { ok: true };
};

export const remove = async (id: number) => {
  if (!Number.isInteger(id) || id <= 0) return false;
  await pool.execute("DELETE FROM luong WHERE id = ?", [id]);
  return true;
};
