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

export const getList = async (req: Request) => {
  const { employeeId, managedDepartmentIds, role } = await getUserScope(req);

  const from = String(req.query.from || "");
  const to = String(req.query.to || "");
  const nhan_vien_id = Number(req.query.nhan_vien_id);

  const where: string[] = [];
  const params: any[] = [];

  if (from) {
    where.push("cc.ngay >= ?");
    params.push(from);
  }
  if (to) {
    where.push("cc.ngay <= ?");
    params.push(to);
  }

  if (role === "manager") {
    if (managedDepartmentIds.length === 0) return [];
    where.push(`nv.phong_ban_id IN (${managedDepartmentIds.map(() => "?").join(",")})`);
    params.push(...managedDepartmentIds);
  } else if (role === "employee") {
    if (!employeeId) return [];
    where.push("cc.nhan_vien_id = ?");
    params.push(employeeId);
  } else if (Number.isInteger(nhan_vien_id)) {
    where.push("cc.nhan_vien_id = ?");
    params.push(nhan_vien_id);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `
      SELECT cc.*, nv.ho_ten, pb.ten_phong_ban
      FROM cham_cong cc
      JOIN nhan_vien nv ON nv.id = cc.nhan_vien_id
      LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
      ${whereSql}
      ORDER BY cc.ngay DESC, cc.id DESC
    `,
    params
  );
  return rows;
};

export const getDetail = async (req: Request) => {
  const { employeeId, managedDepartmentIds, role } = await getUserScope(req);
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return null;

  const where: string[] = ["cc.id = ?"];
  const params: any[] = [id];

  if (role === "manager") {
    if (managedDepartmentIds.length === 0) return null;
    where.push(`nv.phong_ban_id IN (${managedDepartmentIds.map(() => "?").join(",")})`);
    params.push(...managedDepartmentIds);
  } else if (role === "employee") {
    if (!employeeId) return null;
    where.push("cc.nhan_vien_id = ?");
    params.push(employeeId);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;

  const [[row]]: any = await pool.query(
    `
      SELECT cc.*, nv.ho_ten, pb.ten_phong_ban
      FROM cham_cong cc
      JOIN nhan_vien nv ON nv.id = cc.nhan_vien_id
      LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
      ${whereSql}
      LIMIT 1
    `,
    params
  );

  return row;
};

export const createChamCong = async (req: Request) => {
  const { managedDepartmentIds, role } = await getUserScope(req);
  const { nhan_vien_id, ngay, check_in, check_out, ghi_chu } = req.body || {};

  if (!nhan_vien_id || !ngay) {
    return { error: "nhan_vien_id, ngay là bắt buộc", status: 400 };
  }

  if (role === "manager") {
    if (managedDepartmentIds.length === 0) {
      return { error: "Bạn không có quyền tạo cho nhân viên này", status: 403 };
    }
    const [ok]: any = await pool.query(
      `SELECT nv.id FROM nhan_vien nv WHERE nv.id = ? AND nv.phong_ban_id IN (${managedDepartmentIds.map(() => "?").join(",")})`,
      [nhan_vien_id, ...managedDepartmentIds]
    );
    if (!ok.length) {
      return { error: "Bạn không có quyền tạo cho nhân viên này", status: 403 };
    }
  }

  const [r]: any = await pool.query(
    `INSERT INTO cham_cong (nhan_vien_id, ngay, check_in, check_out, ghi_chu) VALUES (?, ?, ?, ?, ?)`,
    [nhan_vien_id, ngay, check_in || null, check_out || null, ghi_chu || null]
  );

  return { data: { id: r.insertId, message: "OK" } };
};

export const updateChamCong = async (req: Request) => {
  const id = Number(req.params.id);
  const { nhan_vien_id, ngay, check_in, check_out, ghi_chu } = req.body || {};
  if (!Number.isFinite(id) || id <= 0) return null;

  const [r]: any = await pool.query(
    `UPDATE cham_cong SET nhan_vien_id=?, ngay=?, check_in=?, check_out=?, ghi_chu=? WHERE id=?`,
    [nhan_vien_id || null, ngay || null, check_in || null, check_out || null, ghi_chu || null, id]
  );
  return r.affectedRows > 0;
};

export const deleteChamCong = async (req: Request) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return null;

  const [r]: any = await pool.query(`DELETE FROM cham_cong WHERE id = ?`, [id]);
  return r.affectedRows > 0;
};
