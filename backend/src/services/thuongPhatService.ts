//thuongPhatService
import { Request } from "express";
import { pool } from "../db";
import { isSalaryLocked } from "../utils/checkPaid";

export const getList = async (req: any) => {
  const { nhan_vien_id, loai, thang, nam, phong_ban_id } = req.query as any;
  const scope = req.phamvi; // thông tin quyền

  const where: string[] = [];
  const params: any[] = [];

  /* ----------------------------
   * 1. GIỮ LOGIC LỌC CŨ
   * ---------------------------- */
  if (nhan_vien_id) {
    where.push("tp.nhan_vien_id = ?");
    params.push(nhan_vien_id);
  }
  if (loai) {
    where.push("tp.loai = ?");
    params.push(loai);
  }
  if (thang) {
    where.push("tp.thang = ?");
    params.push(thang);
  }
  if (nam) {
    where.push("tp.nam = ?");
    params.push(nam);
  }
  if (phong_ban_id) {
    where.push("tp.phong_ban_id = ?");
    params.push(phong_ban_id);
  }

  /* ----------------------------
   * 2. ⭐ PHÂN QUYỀN
   * ---------------------------- */

  // ❌ Employee → chỉ xem phòng ban của họ
  if (scope.role === "employee") {
    where.push("tp.phong_ban_id = ?");
    params.push(scope.departmentId);
  }

  // ⭐ Manager kế toán → xem tất cả PB (không thêm where)
  if (scope.role === "manager" && scope.isAccountingManager) {
    // Không thêm điều kiện phòng ban
  }
  // ⭐ Manager thường → chỉ xem các phòng ban mình quản lý
  else if (scope.role === "manager") {
    if (!scope.managedDepartmentIds || scope.managedDepartmentIds.length === 0) {
      return { items: [] };
    }
    where.push(`tp.phong_ban_id IN (${scope.managedDepartmentIds.map(() => "?").join(",")})`);
    params.push(...scope.managedDepartmentIds);
  }

  // ⭐ Admin → full quyền (không giới hạn)

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  /* ----------------------------
   * 3. TRẢ DỮ LIỆU
   * ---------------------------- */
  const [rows]: any = await pool.query(
    `
      SELECT tp.*, nv.ho_ten, pb.ten_phong_ban
      FROM thuong_phat tp
      LEFT JOIN nhan_vien nv ON nv.id = tp.nhan_vien_id
      LEFT JOIN phong_ban pb ON pb.id = tp.phong_ban_id
      ${whereSql}
      ORDER BY tp.ngay_tao DESC
    `,
    params
  );

  return { items: rows };
};

export const getById = async (id: number) => {
  const [rows]: any = await pool.query("SELECT * FROM thuong_phat WHERE id=?", [id]);
  return rows[0] || null;
};

export const create = async (req: any) => {
  const { nhan_vien_id, phong_ban_id, loai, ly_do, so_tien, ghi_chu, thang, nam } = req.body;

  const user = req.user;
  const scope = req.phamvi;

  /* ----------------------------
   * 🔒 1. KHÓA LƯƠNG
   * ---------------------------- */
  if (await isSalaryLocked(nhan_vien_id, thang, nam)) {
    return { error: "Tháng này đã trả lương — không thể thêm thưởng/phạt!" };
  }

  /* ----------------------------
   * ⭐ 2. PHÂN QUYỀN
   * ---------------------------- */

  // ❌ Employee → không được thêm
  if (scope.role === "employee") {
    return { error: "Nhân viên không thể thêm thưởng/phạt" };
  }

  // ⭐ Manager kế toán → thêm cho tất cả phòng ban
  const isKeToanManager = scope.role === "manager" && scope.isAccountingManager;

  // Manager thường → chỉ thêm phòng ban mình
  if (scope.role === "manager" && !isKeToanManager) {
    if (!scope.managedDepartmentIds.includes(phong_ban_id)) {
      return { error: "Bạn không có quyền thêm của phòng ban này" };
    }
  }

  // Admin → full quyền

  /* ----------------------------
   * ⭐ 3. THÊM (GIỮ LOGIC CŨ)
   * ---------------------------- */
  const [r]: any = await pool.query(
    `INSERT INTO thuong_phat 
     (nhan_vien_id, phong_ban_id, thang, nam, loai, ly_do, so_tien, ghi_chu, nguoi_tao_id, ngay_tao)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [nhan_vien_id, phong_ban_id, thang, nam, loai, ly_do, so_tien, ghi_chu, user.id]
  );

  return { id: r.insertId };
};

export const update = async (id: number, req: any) => {
  // (Bạn nói không dùng update → mình giữ nguyên, không chỉnh)
  return { error: "Hệ thống không hỗ trợ sửa thưởng/phạt" };
};

export const remove = async (id: number, req: any) => {
  const scope = req.phamvi;

  const [[row]]: any = await pool.query(
    "SELECT nhan_vien_id, phong_ban_id, thang, nam FROM thuong_phat WHERE id=?",
    [id]
  );

  if (!row) return false;

  /* ----------------------------
   * 🔒 KHÓA LƯƠNG
   * ---------------------------- */
  if (await isSalaryLocked(row.nhan_vien_id, row.thang, row.nam)) {
    return { error: "Tháng này đã trả lương — không thể xoá!", status: 400 };
  }

  /* ----------------------------
   * ⭐ PHÂN QUYỀN XOÁ
   * ---------------------------- */

  // Employee → không xoá
  if (scope.role === "employee") {
    return { error: "Bạn không có quyền xoá", status: 403 };
  }

  // Manager kế toán → xoá tất cả
  const isKeToanManager = scope.role === "manager" && scope.isAccountingManager;

  if (scope.role === "manager" && !isKeToanManager) {
    if (!scope.managedDepartmentIds.includes(row.phong_ban_id)) {
      return {
        error: "Không thể xoá bản ghi phòng ban khác",
        status: 403,
      };
    }
  }

  // Admin + Manager kế toán → xoá tự do
  const [r]: any = await pool.query("DELETE FROM thuong_phat WHERE id=?", [id]);
  return r.affectedRows > 0;
};
