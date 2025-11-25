// src/tiện-ích/phạm-vi-người-dùng.ts
import { pool } from "../db";
import { Request } from "express";

export type VaiTro = "admin" | "manager" | "employee";

export type PhepPhamVi = {
  employeeId: number | null;
  managedDepartmentIds: number[];
  role: VaiTro;
  isAccountingManager: boolean;
};

/**
 * Lấy phạm vi người dùng hiện tại (để xác định quyền và giới hạn dữ liệu)
 */
export async function layPhamViNguoiDung(req: Request): Promise<PhepPhamVi> {
  const user = (req as any).user as { id: number };

  const [[me]]: any = await pool.query(
    `
    SELECT 
      tk.nhan_vien_id AS employeeId,
      cv.quyen_mac_dinh AS role,
      pb.ten_phong_ban AS department
    FROM tai_khoan tk
    LEFT JOIN nhan_vien nv ON tk.nhan_vien_id = nv.id
    LEFT JOIN chuc_vu cv ON nv.chuc_vu_id = cv.id
    LEFT JOIN phong_ban pb ON nv.phong_ban_id = pb.id
    WHERE tk.id = ? LIMIT 1
    `,
    [user.id]
  );

  let managedDepartmentIds: number[] = [];

  if (me?.role === "manager") {
    const [rows]: any = await pool.query(`SELECT id FROM phong_ban WHERE manager_taikhoan_id = ?`, [
      user.id,
    ]);
    managedDepartmentIds = rows.map((r: any) => r.id);
  }

  return {
    employeeId: me?.employeeId ?? null,
    managedDepartmentIds,
    role: me?.role ?? "employee",

    // ⭐ FIX CHUẨN: nhận diện manager Kế toán
    isAccountingManager:
      me?.role === "manager" &&
      (me?.department?.toLowerCase().includes("kế toán") ||
        me?.department?.toLowerCase().includes("ke toan")),
  };
}
