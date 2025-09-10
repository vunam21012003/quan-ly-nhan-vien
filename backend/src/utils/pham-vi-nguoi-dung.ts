// src/tiện-ích/phạm-vi-người-dùng.ts
import { pool } from "../db";
import { Request } from "express";

export type VaiTro = "admin" | "manager" | "employee";
export type PhepPhamVi = {
  employeeId?: number | null;
  managedDepartmentIds: number[];
};

export async function lấyPhạmViNgườiDùng(req: Request): Promise<PhepPhamVi> {
  const user = (req as any).user as { id: number; role: VaiTro };

  // lấy nhan_vien_id từ bảng tài khoản
  const [[me]]: any = await pool.query(
    `SELECT nhan_vien_id AS employeeId FROM tai_khoan WHERE id = ? LIMIT 1`,
    [user.id]
  );

  // nếu là manager → lấy danh sách phòng ban mà tài khoản này quản lý
  let managedDepartmentIds: number[] = [];
  if (user.role === "manager") {
    const [rows]: any = await pool.query(`SELECT id FROM phong_ban WHERE manager_taikhoan_id = ?`, [
      user.id,
    ]);
    managedDepartmentIds = rows.map((r: any) => r.id);
  }

  return { employeeId: me?.employeeId ?? null, managedDepartmentIds };
}
