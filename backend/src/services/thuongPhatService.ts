// src/services/thuongPhatService.ts (FULL CODE ĐÃ CHỈNH SỬA)
import { pool } from "../db";
import { isSalaryLocked } from "../utils/checkPaid";

export const getList = async (req: any) => {
  const { nhan_vien_id, loai, thang, nam, phong_ban_id } = req.query;
  const scope = req.phamvi; // ⭐ LẤY PHẠM VI ĐÃ XỬ LÝ TRONG auth.ts

  const where: string[] = [];
  const params: any[] = [];

  // ------------------------------
  // 1) LỌC CƠ BẢN
  // ------------------------------
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

  // ------------------------------
  // 2) PHÂN QUYỀN
  // ------------------------------
  if (scope.role === "employee") {
    // ⭐ ĐÃ SỬA: Nhân viên chỉ xem thưởng/phạt của phòng ban họ
    // Lọc theo phong_ban_id của nhân viên hiện tại
    where.push("tp.phong_ban_id = (SELECT phong_ban_id FROM nhan_vien WHERE id = ?)");
    params.push(scope.employeeId);
  }

  // ⭐ Manager kế toán xem tất cả
  if (scope.role === "manager" && scope.isAccountingManager) {
    // không thêm điều kiện PB
  }
  // ⭐ Manager thường → chỉ PB họ quản lý
  else if (scope.role === "manager") {
    if (!scope.managedDepartmentIds.length) {
      return { items: [] };
    }
    where.push(`tp.phong_ban_id IN (${scope.managedDepartmentIds.map(() => "?").join(",")})`);
    params.push(...scope.managedDepartmentIds);
  }

  // Admin → xem tất cả

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

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

// =======================================================================
// CREATE
// =======================================================================
export const create = async (req: any) => {
  const { nhan_vien_id, phong_ban_id, loai, ly_do, so_tien, ghi_chu, thang, nam } = req.body;
  const scope = req.phamvi;
  const user = req.user;

  if (await isSalaryLocked(nhan_vien_id, thang, nam)) {
    return { error: "Tháng này đã trả lương — không thể thêm thưởng/phạt!" };
  }

  if (scope.role === "employee") {
    return { error: "Nhân viên không thể thêm thưởng/phạt" };
  }

  const isKeToanManager = scope.role === "manager" && scope.isAccountingManager;

  if (scope.role === "manager" && !isKeToanManager) {
    if (!scope.managedDepartmentIds.includes(phong_ban_id)) {
      return { error: "Bạn không có quyền thêm của phòng ban này" };
    }
  }

  const [r]: any = await pool.query(
    `INSERT INTO thuong_phat 
      (nhan_vien_id, phong_ban_id, thang, nam, loai, ly_do, so_tien, ghi_chu, nguoi_tao_id, ngay_tao)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [nhan_vien_id, phong_ban_id, thang, nam, loai, ly_do, so_tien, ghi_chu, user.id]
  );

  return { id: r.insertId };
};

// =======================================================================
// REMOVE
// =======================================================================
export const remove = async (id: number, req: any) => {
  const scope = req.phamvi;

  const [[row]]: any = await pool.query(
    "SELECT nhan_vien_id, phong_ban_id, thang, nam FROM thuong_phat WHERE id=?",
    [id]
  );

  if (!row) return { error: "Không tìm thấy" };

  if (await isSalaryLocked(row.nhan_vien_id, row.thang, row.nam)) {
    return { error: "Tháng này đã trả lương — không thể xoá!" };
  }

  const isKeToan = scope.role === "manager" && scope.isAccountingManager;

  if (scope.role === "employee") {
    return { error: "Bạn không có quyền xoá" };
  }

  if (scope.role === "manager" && !isKeToan) {
    if (!scope.managedDepartmentIds.includes(row.phong_ban_id)) {
      return { error: "Không thể xoá bản ghi phòng ban khác" };
    }
  }

  const [r]: any = await pool.query("DELETE FROM thuong_phat WHERE id=?", [id]);
  return r.affectedRows > 0 ? { ok: true } : { error: "Xoá thất bại" };
};
