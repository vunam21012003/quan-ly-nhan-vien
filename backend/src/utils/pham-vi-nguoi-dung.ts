// src/utils/pham-vi-nguoi-dung.ts
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
  const user = (req as any).user as { id: number; nhan_vien_id?: number };

  // Lấy thông tin tài khoản + nhân viên + chức vụ + phòng ban
  const [[meFromDB]]: any = await pool.query(
    `
    SELECT 
      tk.nhan_vien_id AS employeeId,
      cv.quyen_mac_dinh AS role,
      pb.id AS phong_ban_id,
      pb.ten_phong_ban AS department
    FROM tai_khoan tk
    LEFT JOIN nhan_vien nv ON tk.nhan_vien_id = nv.id
    LEFT JOIN chuc_vu cv ON nv.chuc_vu_id = cv.id
    LEFT JOIN phong_ban pb ON nv.phong_ban_id = pb.id
    WHERE tk.id = ? LIMIT 1
    `,
    [user.id]
  );

  const me = {
    employeeId: meFromDB?.employeeId ?? null,
    role: meFromDB?.role ?? "employee",
    department: meFromDB?.department ?? null,
    phong_ban_id: meFromDB?.phong_ban_id ?? null,
  };

  let managedDepartmentIds: number[] = [];

  // Nếu là Manager → xem các phòng họ được giao quản lý
  if (me.role === "manager") {
    const [rows]: any = await pool.query(`SELECT id FROM phong_ban WHERE manager_taikhoan_id = ?`, [
      user.id,
    ]);

    managedDepartmentIds = rows.map((r: any) => r.id);

    // PHƯƠNG ÁN A: Nếu manager không được giao phòng → fallback về phòng của chính họ
    if (managedDepartmentIds.length === 0 && me.phong_ban_id) {
      managedDepartmentIds = [me.phong_ban_id];
    }
  }

  // Kiểm tra có phải manager phòng kế toán không
  const isAccountingManager =
    me.role === "manager" &&
    (me.department?.toLowerCase().includes("kế toán") ||
      me.department?.toLowerCase().includes("ke toan") ||
      me.department?.toLowerCase().includes("accounting"));

  return {
    employeeId: me.employeeId,
    managedDepartmentIds,
    role: me.role as VaiTro,
    isAccountingManager,
  };
}
