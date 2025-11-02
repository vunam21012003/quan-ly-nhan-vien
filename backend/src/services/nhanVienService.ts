import { pool } from "../db";
import { NhanVien } from "../models/nhanVien";
import { removeVietnameseTones } from "../utils/xoa-dau-tai-khoan";
import { layPhamViNguoiDung } from "../utils/pham-vi-nguoi-dung";
import * as taiKhoanService from "./taiKhoanService";

/** Helper: kiểm tra user hiện tại có phải Manager phòng Kế Toán không */
async function isAccountingManager(userAccountId: number): Promise<boolean> {
  const [[row]]: any = await pool.query(
    `SELECT 1 FROM phong_ban 
     WHERE manager_taikhoan_id = ? AND ten_phong_ban LIKE '%Kế Toán%' LIMIT 1`,
    [userAccountId]
  );
  return !!row;
}

/** Liệt kê nhân viên có phân trang + lọc + theo phạm vi quyền */
export const getAll = async (req: any) => {
  const search = (req.query.search as string) || "";
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const chucVuId = Number(req.query.chuc_vu_id) || null;
  const phongBanId = Number(req.query.phong_ban_id) || null;
  const offset = (page - 1) * limit;

  const scope = await layPhamViNguoiDung(req);

  const where: string[] = [];
  const params: any[] = [];

  if (search) {
    where.push(`(nv.ho_ten LIKE ? OR nv.email LIKE ? OR nv.so_dien_thoai LIKE ?)`);
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (chucVuId) {
    where.push(`nv.chuc_vu_id = ?`);
    params.push(chucVuId);
  }
  if (phongBanId) {
    where.push(`nv.phong_ban_id = ?`);
    params.push(phongBanId);
  }

  // Áp dụng phạm vi theo role
  if (scope.role === "employee" && scope.employeeId) {
    where.push(`nv.id = ?`);
    params.push(scope.employeeId);
  } else if (scope.role === "manager" && scope.managedDepartmentIds.length) {
    where.push(`nv.phong_ban_id IN (${scope.managedDepartmentIds.map(() => "?").join(",")})`);
    params.push(...scope.managedDepartmentIds);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows]: any = await pool.query(
    `SELECT 
       nv.id, nv.ho_ten, nv.gioi_tinh, nv.ngay_sinh, nv.dia_chi, nv.so_dien_thoai, nv.email,
       nv.anh_dai_dien, nv.phong_ban_id, nv.chuc_vu_id, nv.ngay_vao_lam, nv.trang_thai, nv.ghi_chu,
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
    `SELECT COUNT(*) AS total
     FROM nhan_vien nv
     ${whereSql}`,
    params
  );

  return { items: rows, total };
};

export const getById = async (req: any, id: number) => {
  const scope = await layPhamViNguoiDung(req);

  const [rows]: any = await pool.query(
    `SELECT 
       nv.*, pb.ten_phong_ban, cv.ten_chuc_vu, cv.quyen_mac_dinh, cv.muc_luong_co_ban
     FROM nhan_vien nv
     LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
     LEFT JOIN chuc_vu   cv ON cv.id = nv.chuc_vu_id
     WHERE nv.id = ?
     LIMIT 1`,
    [id]
  );
  const row = rows?.[0];
  if (!row) return null;

  // Kiểm tra phạm vi xem
  if (scope.role === "employee" && scope.employeeId !== row.id) return null;
  if (scope.role === "manager" && !scope.managedDepartmentIds.includes(row.phong_ban_id))
    return null;

  return row;
};

/** Tạo NHÂN VIÊN + Auto tạo TÀI KHOẢN (quyền theo chuc_vu.quyen_mac_dinh) */
export const create = async (req: any, data: NhanVien) => {
  const userId = (req as any).user?.id as number;
  const scope = await layPhamViNguoiDung(req);

  // Quyền: admin luôn OK, manager chỉ OK nếu là trưởng phòng Kế Toán
  if (
    !(scope.role === "admin" || (scope.role === "manager" && (await isAccountingManager(userId))))
  ) {
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
  } = data;

  // 🧩 Thêm mới nhân viên
  const [rNv]: any = await pool.query(
    `INSERT INTO nhan_vien 
     (ho_ten, gioi_tinh, ngay_sinh, dia_chi, so_dien_thoai, email, anh_dai_dien,
      phong_ban_id, chuc_vu_id, ngay_vao_lam, trang_thai, ghi_chu)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
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
    ]
  );

  const nhan_vien_id = rNv.insertId;

  // 🔎 Lấy quyền mặc định theo chức vụ
  const [[cv]]: any = await pool.query(`SELECT quyen_mac_dinh FROM chuc_vu WHERE id=? LIMIT 1`, [
    chuc_vu_id,
  ]);
  const quyen = cv?.quyen_mac_dinh || "employee";

  // 🧩 Sinh username không dấu, tránh trùng
  const parts = removeVietnameseTones(ho_ten).toLowerCase().trim().split(/\s+/);
  const lastName = parts.pop();
  const firstPart = parts.length > 0 ? parts[0] : "nv";
  let base = `${lastName}.${firstPart}`; // ví dụ: a.nguyen

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

  // ✅ Gọi service tạo tài khoản (tự động bcrypt hash mật khẩu)
  const tk = await taiKhoanService.create({
    nhan_vien_id,
    chuc_vu_id: chuc_vu_id || null,
    ten_dang_nhap,
    mat_khau: "123456",
    trang_thai: "active",
  });

  return { id: nhan_vien_id, taikhoan_id: tk.id, ten_dang_nhap, quyen };
};

export const update = async (req: any, id: number, data: Partial<NhanVien>) => {
  const userId = (req as any).user?.id as number;
  const scope = await layPhamViNguoiDung(req);

  // Chỉ admin hoặc manager Kế Toán được update
  if (
    !(scope.role === "admin" || (scope.role === "manager" && (await isAccountingManager(userId))))
  ) {
    return { error: "Bạn không có quyền cập nhật" };
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
  if (
    !(scope.role === "admin" || (scope.role === "manager" && (await isAccountingManager(userId))))
  ) {
    return { error: "Bạn không có quyền xoá" };
  }
  const [r]: any = await pool.query(`DELETE FROM nhan_vien WHERE id=?`, [id]);
  return { ok: r.affectedRows > 0 };
};

// Dùng cho trang Chức vụ: lấy danh sách NV theo chuc_vu_id
export const getByChucVu = async (chuc_vu_id: number) => {
  const [rows]: any = await pool.query(
    `SELECT id, ho_ten, email FROM nhan_vien WHERE chuc_vu_id = ? ORDER BY id DESC`,
    [chuc_vu_id]
  );
  return rows;
};
