// services/nhanVienService.ts

import { pool } from "../db";
import { NhanVien } from "../models/nhanVien";
import { removeVietnameseTones } from "../utils/xoa-dau-tai-khoan";
import { layPhamViNguoiDung } from "../utils/pham-vi-nguoi-dung";
import * as taiKhoanService from "./taiKhoanService";

/** Helper: Kiểm tra User ID có phải là Manager thuộc phòng có tên chứa "Kế Toán" không */
async function isAccountingManager(userId: number): Promise<boolean> {
  // Tìm phòng ban mà user này làm manager, và tên phòng ban có chữ 'Kế Toán' (hoặc 'ke toan')
  const [[row]]: any = await pool.query(
    `SELECT 1 FROM phong_ban 
     WHERE manager_taikhoan_id = ? 
     AND (ten_phong_ban LIKE '%Kế Toán%' OR ten_phong_ban LIKE '%Ke Toan%') 
     LIMIT 1`,
    [userId]
  );
  return !!row;
}

/** Liệt kê nhân viên */
export const getAll = async (req: any) => {
  const userId = (req as any).user?.id as number;
  const search = (req.query.search as string) || "";
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const chucVuId = Number(req.query.chuc_vu_id) || null;
  const phongBanId = Number(req.query.phong_ban_id) || null;
  const offset = (page - 1) * limit;

  const scope = await layPhamViNguoiDung(req);

  // ⭐ CHECK QUYỀN ĐẶC BIỆT
  const isKeToan = scope.isAccountingManager;
  const isSuperUser = scope.role === "admin" || isKeToan;

  const where: string[] = [];
  const params: any[] = [];

  // ----- Search -----
  if (search) {
    where.push(`(nv.ho_ten LIKE ? OR nv.email LIKE ? OR nv.so_dien_thoai LIKE ?)`);
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  // ----- Chức vụ -----
  if (chucVuId) {
    where.push(`nv.chuc_vu_id = ?`);
    params.push(chucVuId);
  }

  // ⭐⭐⭐ FIX QUAN TRỌNG — Nếu là Admin hoặc Manager Kế Toán → KHÔNG lọc phòng ban
  if (!isSuperUser) {
    if (phongBanId) {
      where.push(`nv.phong_ban_id = ?`);
      params.push(phongBanId);
    }
  }

  // ----- Áp dụng phạm vi theo role -----
  if (!isSuperUser) {
    if (scope.role === "employee" && scope.employeeId) {
      where.push(`nv.id = ?`);
      params.push(scope.employeeId);
    } else if (scope.role === "manager" && scope.managedDepartmentIds.length) {
      where.push(`nv.phong_ban_id IN (${scope.managedDepartmentIds.map(() => "?").join(",")})`);
      params.push(...scope.managedDepartmentIds);
    }
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows]: any = await pool.query(
    `SELECT 
       nv.id, nv.ho_ten, nv.gioi_tinh, nv.ngay_sinh, nv.dia_chi, nv.so_dien_thoai, nv.email,
       nv.anh_dai_dien, nv.phong_ban_id, nv.chuc_vu_id, nv.ngay_vao_lam, nv.trang_thai, nv.ghi_chu,
       nv.so_nguoi_phu_thuoc,
       pb.ten_phong_ban, cv.ten_chuc_vu, cv.quyen_mac_dinh, cv.muc_luong_co_ban
     FROM nhan_vien nv
     LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
     LEFT JOIN chuc_vu   cv ON cv.id = nv.chuc_vu_id
     ${whereSql}
     ORDER BY nv.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [[{ total }]]: any = await pool.query(
    `SELECT COUNT(*) AS total FROM nhan_vien nv ${whereSql}`,
    params
  );

  return { items: rows, total };
};

/** Get By ID */
export const getById = async (req: any, id: number) => {
  const userId = (req as any).user?.id as number;
  const scope = await layPhamViNguoiDung(req);
  const isKeToan = scope.isAccountingManager; // ⭐ Dùng từ pham-vi-nguoi-dung
  const isSuperUser = scope.role === "admin" || isKeToan;

  const [rows]: any = await pool.query(
    `SELECT nv.*, pb.ten_phong_ban, cv.ten_chuc_vu, cv.quyen_mac_dinh, cv.muc_luong_co_ban
     FROM nhan_vien nv
     LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
     LEFT JOIN chuc_vu   cv ON cv.id = nv.chuc_vu_id
     WHERE nv.id = ? LIMIT 1`,
    [id]
  );
  const row = rows?.[0];
  if (!row) return null;

  // Nếu là SuperUser thì xem được hết, ngược lại check phạm vi
  if (!isSuperUser) {
    if (scope.role === "employee" && scope.employeeId !== row.id) return null;
    if (scope.role === "manager" && !scope.managedDepartmentIds.includes(row.phong_ban_id))
      return null;
  }

  return row;
};

/** Tạo NHÂN VIÊN */
export const create = async (req: any, data: NhanVien) => {
  const userId = (req as any).user?.id as number;
  const scope = await layPhamViNguoiDung(req);

  // ⭐ CHECK QUYỀN ĐẶC BIỆT
  const isKeToan = scope.isAccountingManager; // ⭐ Dùng từ pham-vi-nguoi-dung
  const isSuperUser = scope.role === "admin" || isKeToan;

  // 1. Kiểm tra quyền chung
  if (!isSuperUser && scope.role !== "manager") {
    return { error: "Bạn không có quyền tạo nhân viên" };
  }

  const {
    ho_ten,
    gioi_tinh,
    ngay_sinh,
    dia_chi,
    so_dien_thoai,
    email,
    anh_dai_dien,
    phong_ban_id,
    chuc_vu_id,
    ngay_vao_lam,
    trang_thai = "dang_lam",
    ghi_chu,
    so_nguoi_phu_thuoc = 0,
  } = data;

  // 2. Logic giới hạn: Nếu là Manager thường (không phải Kế toán) -> chỉ được tạo trong phòng mình
  if (scope.role === "manager" && !isKeToan) {
    if (!phong_ban_id || !scope.managedDepartmentIds.includes(Number(phong_ban_id))) {
      return { error: "Bạn chỉ có thể thêm nhân viên vào phòng ban bạn quản lý." };
    }
  }

  // ⭐ LẤY QUYỀN MẶC ĐỊNH CỦA CHỨC VỤ
  const [[cvCheck]]: any = await pool.query(
    `SELECT quyen_mac_dinh FROM chuc_vu WHERE id = ? LIMIT 1`,
    [chuc_vu_id]
  );
  const roleDefault = cvCheck?.quyen_mac_dinh || "employee";

  // Nếu không phải Admin thật, không được tạo acc Admin
  if (scope.role !== "admin" && roleDefault === "admin") {
    // Tùy chọn: Có thể cho phép Kế toán tạo Admin hoặc không.
    // Ở đây tôi chặn để an toàn, chỉ Admin hệ thống mới tạo được Admin khác.
    return { error: "Chỉ quản trị viên hệ thống mới được tạo tài khoản Admin." };
  }

  // Bắt buộc chọn phòng ban nếu không phải role admin
  if (roleDefault !== "admin" && !phong_ban_id) {
    return { error: "Vui lòng chọn phòng ban cho chức vụ này" };
  }

  // Insert DB
  const [rNv]: any = await pool.query(
    `INSERT INTO nhan_vien 
     (ho_ten, gioi_tinh, ngay_sinh, dia_chi, so_dien_thoai, email, anh_dai_dien,
      phong_ban_id, chuc_vu_id, ngay_vao_lam, trang_thai, ghi_chu, so_nguoi_phu_thuoc)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      ho_ten,
      gioi_tinh,
      ngay_sinh || null,
      dia_chi || null,
      so_dien_thoai || null,
      email || null,
      anh_dai_dien || null,
      phong_ban_id || null,
      chuc_vu_id || null,
      ngay_vao_lam || null,
      trang_thai,
      ghi_chu || null,
      so_nguoi_phu_thuoc,
    ]
  );
  const nhan_vien_id = rNv.insertId;

  // Tạo username
  const parts = removeVietnameseTones(ho_ten).toLowerCase().trim().split(/\s+/);
  const lastName = parts.pop();
  const firstPart = parts.length > 0 ? parts[0] : "nv";
  let base = `${lastName}.${firstPart}`;
  let ten_dang_nhap = base;
  let suffix = 1;
  while (true) {
    const [[exist]]: any = await pool.query(
      "SELECT id FROM tai_khoan WHERE ten_dang_nhap = ? LIMIT 1",
      [ten_dang_nhap]
    );
    if (!exist) break;
    suffix++;
    ten_dang_nhap = `${base}${suffix}`;
  }

  const tk = await taiKhoanService.create({
    nhan_vien_id,
    chuc_vu_id: chuc_vu_id || null,
    ten_dang_nhap,
    mat_khau: "123456",
    trang_thai: "active",
  });

  return { id: nhan_vien_id, taikhoan_id: tk.id, ten_dang_nhap, quyen: roleDefault };
};

export const update = async (req: any, id: number, data: Partial<NhanVien>) => {
  const userId = (req as any).user?.id as number;
  const scope = await layPhamViNguoiDung(req);

  const isKeToan = scope.isAccountingManager; // ⭐ Dùng từ pham-vi-nguoi-dung
  const isSuperUser = scope.role === "admin" || isKeToan;

  if (!isSuperUser && scope.role !== "manager") {
    return { error: "Bạn không có quyền cập nhật" };
  }

  // Nếu là Manager thường (không phải Kế toán), check quyền sở hữu phòng ban
  if (scope.role === "manager" && !isKeToan) {
    const [[targetNv]]: any = await pool.query(`SELECT phong_ban_id FROM nhan_vien WHERE id=?`, [
      id,
    ]);
    if (!targetNv || !scope.managedDepartmentIds.includes(targetNv.phong_ban_id)) {
      return { error: "Bạn không có quyền sửa nhân viên phòng khác." };
    }
    // Không cho đổi sang phòng khác
    if (data.phong_ban_id && !scope.managedDepartmentIds.includes(Number(data.phong_ban_id))) {
      return { error: "Bạn không thể chuyển nhân viên sang phòng ban khác." };
    }
  }

  const fields = [
    "ho_ten",
    "gioi_tinh",
    "ngay_sinh",
    "dia_chi",
    "so_dien_thoai",
    "email",
    "anh_dai_dien",
    "phong_ban_id",
    "chuc_vu_id",
    "ngay_vao_lam",
    "trang_thai",
    "ghi_chu",
    "so_nguoi_phu_thuoc",
  ] as const;

  const sets: string[] = [];
  const params: any[] = [];
  for (const k of fields) {
    if (k in data) {
      sets.push(`${k} = ?`);
      // @ts-ignore
      params.push(data[k] ?? null);
    }
  }

  if (!sets.length) return { ok: true };
  params.push(id);

  const [r]: any = await pool.query(`UPDATE nhan_vien SET ${sets.join(", ")} WHERE id = ?`, params);
  return { ok: r.affectedRows > 0 };
};

export const remove = async (req: any, id: number) => {
  const userId = (req as any).user?.id as number;
  const scope = await layPhamViNguoiDung(req);

  // ⭐ YÊU CẦU: Chỉ ADMIN được xoá nhân viên
  if (scope.role !== "admin") {
    return { error: "Chỉ quản trị viên mới có quyền xoá nhân viên." };
  }

  // ⭐ ADMIN → được xoá bất kỳ nhân viên nào
  const [r]: any = await pool.query(`DELETE FROM nhan_vien WHERE id=?`, [id]);
  return { ok: r.affectedRows > 0 };
};

// getByChucVu giữ nguyên
export const getByChucVu = async (chuc_vu_id: number) => {
  const [rows]: any = await pool.query(
    `SELECT id, ho_ten, email FROM nhan_vien WHERE chuc_vu_id = ? ORDER BY id DESC`,
    [chuc_vu_id]
  );
  return rows;
};

// ⭐ THÊM MỚI: Cập nhật riêng số người phụ thuộc (cho Manager Kế Toán)
export const updateNguoiPhuThuoc = async (req: any, id: number, so_nguoi_phu_thuoc: number) => {
  const scope = await layPhamViNguoiDung(req);

  const isKeToan = scope.isAccountingManager;

  // Chỉ Admin hoặc Manager Kế Toán mới được gọi endpoint này
  if (scope.role !== "admin" && !isKeToan) {
    return { error: "Chỉ Admin hoặc Kế Toán mới được cập nhật số người phụ thuộc" };
  }

  // Validate giá trị
  const value = Number(so_nguoi_phu_thuoc);
  if (!Number.isFinite(value) || value < 0 || value > 20) {
    return { error: "Số người phụ thuộc phải từ 0 đến 20" };
  }

  // Kiểm tra nhân viên tồn tại
  const [[nv]]: any = await pool.query(`SELECT id FROM nhan_vien WHERE id = ? LIMIT 1`, [id]);
  if (!nv) {
    return { error: "Không tìm thấy nhân viên" };
  }

  // Cập nhật
  const [r]: any = await pool.query(`UPDATE nhan_vien SET so_nguoi_phu_thuoc = ? WHERE id = ?`, [
    value,
    id,
  ]);

  return { ok: r.affectedRows > 0 };
};
