// services/nhanVienService.ts

import { pool } from "../db";
import ExcelJS from "exceljs";
import { NhanVien } from "../models/nhanVien";
import { removeVietnameseTones } from "../utils/xoa-dau-tai-khoan";
import { layPhamViNguoiDung } from "../utils/pham-vi-nguoi-dung";
import * as taiKhoanService from "./taiKhoanService";
import * as thongBaoService from "./thongBaoService";

/** Liệt kê nhân viên */
export const getAll = async (req: any) => {
  const search = (req.query.search as string) || "";
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const chucVuId = Number(req.query.chuc_vu_id) || null;
  const phongBanId = Number(req.query.phong_ban_id) || null;
  const offset = (page - 1) * limit;

  const scope = await layPhamViNguoiDung(req);
  const isKeToan = scope.isAccountingManager;
  const isSuperUser = scope.role === "admin" || isKeToan;

  const where: string[] = ["nv.da_xoa = 0"];
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

  // Lọc theo phòng ban
  if (!isSuperUser) {
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
  const scope = await layPhamViNguoiDung(req);
  const isSuperUser = scope.role === "admin" || scope.isAccountingManager;

  const [rows]: any = await pool.query(
    `SELECT nv.*, pb.ten_phong_ban, cv.ten_chuc_vu, cv.quyen_mac_dinh, cv.muc_luong_co_ban
     FROM nhan_vien nv
     LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
     LEFT JOIN chuc_vu   cv ON cv.id = nv.chuc_vu_id
     WHERE nv.id = ? AND nv.da_xoa = 0 LIMIT 1`, // ⭐ Lọc da_xoa ở đây
    [id]
  );
  const row = rows?.[0];
  if (!row) return null;

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

  const isKeToan = scope.isAccountingManager;
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

  //  VALIDATE (mới tích hợp)
  const validateErr = await validateNhanVien(
    {
      email,
      so_dien_thoai,
      so_nguoi_phu_thuoc,
      ngay_sinh,
      ngay_vao_lam,
      phong_ban_id,
      chuc_vu_id,
    },
    null
  );
  if (validateErr) return { error: validateErr };

  // 2. Logic giới hạn: Nếu là Manager thường  -> chỉ được tạo trong phòng mình
  if (scope.role === "manager" && !isKeToan) {
    if (!phong_ban_id || !scope.managedDepartmentIds.includes(Number(phong_ban_id))) {
      return { error: "Bạn chỉ có thể thêm nhân viên vào phòng ban bạn quản lý." };
    }
  }

  // LẤY THÔNG TIN CHỨC VỤ (bao gồm ten_chuc_vu và quyen_mac_dinh)
  const [[chucVu]]: any = await pool.query(
    `SELECT ten_chuc_vu, quyen_mac_dinh FROM chuc_vu WHERE id = ? LIMIT 1`,
    [chuc_vu_id]
  );

  if (!chucVu) {
    return { error: "Chức vụ không hợp lệ." };
  }

  const roleDefault = chucVu?.quyen_mac_dinh || "employee";
  const tenChucVu = chucVu?.ten_chuc_vu || "";

  // Kiểm tra chức vụ manager/admin đã có người nắm giữ chưa
  if (roleDefault === "manager" || roleDefault === "admin") {
    const [[existing]]: any = await pool.query(
      `SELECT id FROM nhan_vien WHERE chuc_vu_id = ? LIMIT 1`,
      [chuc_vu_id]
    );
    if (existing) {
      return {
        error:
          "Chức vụ này (quyền " +
          roleDefault +
          ") đã được gán cho một nhân viên khác. Mỗi chức vụ manager/admin chỉ được 1 người.",
      };
    }
  }

  // Nếu không phải Admin thật, không được tạo acc Admin
  if (scope.role !== "admin" && roleDefault === "admin") {
    return { error: "Chỉ quản trị viên hệ thống mới được tạo tài khoản Admin." };
  }

  // Bắt buộc chọn phòng ban nếu không phải role admin
  if (roleDefault !== "admin" && !phong_ban_id) {
    return { error: "Vui lòng chọn phòng ban cho nhân viên." };
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

  // Tạo tài khoản
  const tk = await taiKhoanService.create({
    nhan_vien_id,
    chuc_vu_id: chuc_vu_id || null,
    ten_dang_nhap,
    mat_khau: "123456",
    trang_thai: "active",
  });

  // ==================================================
  // TỰ ĐỘNG CẬP NHẬT TRƯỞNG PHÒNG KHI TẠO NHÂN VIÊN MỚI
  // =============================================================
  try {
    const isManagerRole = roleDefault === "manager";
    const isTruongPhong = tenChucVu.toLowerCase().includes("trưởng phòng");

    if (isManagerRole && isTruongPhong && phong_ban_id && tk.id) {
      console.log(`>>> [CREATE] Tự động cập nhật Trưởng phòng cho phòng ban ID: ${phong_ban_id}`);
      await pool.query(`UPDATE phong_ban SET manager_taikhoan_id = ? WHERE id = ?`, [
        tk.id,
        phong_ban_id,
      ]);
    }
  } catch (error) {
    console.error("Lỗi khi tự động cập nhật trưởng phòng (create):", error);
  }
  // ======================= KẾT THÚC LOGIC MỚI =======================

  return { id: nhan_vien_id, taikhoan_id: tk.id, ten_dang_nhap, quyen: roleDefault };
};

/** ====================================================================
 *  CẬP NHẬT NHÂN VIÊN
 *  ==================================================================== */
export const update = async (req: any, id: number, data: Partial<NhanVien>) => {
  const userId = (req as any).user?.nhan_vien_id as number;
  const scope = await layPhamViNguoiDung(req);

  // BƯỚC 1: XÁC ĐỊNH NHÂN VIÊN ĐANG YÊU CẦU
  const requesterNhanVienId = (req as any).user?.nhan_vien_id as number;
  const isSelfUpdate = requesterNhanVienId === id;

  const isKeToan = scope.isAccountingManager;
  const isSuperUser = scope.role === "admin" || isKeToan;

  // Cho phép nếu là Admin/Manager HOẶC đang sửa chính mình
  if (!isSuperUser && !isSelfUpdate) {
    return { error: "Bạn không có quyền cập nhật" };
  }

  // LẤY THÔNG TIN CŨ CỦA NHÂN VIÊN TRƯỚC KHI UPDATE
  const [[oldData]]: any = await pool.query(
    `SELECT ho_ten, email, so_dien_thoai, dia_chi, phong_ban_id, chuc_vu_id FROM nhan_vien WHERE id = ?`,
    [id]
  );

  if (!oldData) {
    return { error: "Không tìm thấy nhân viên." };
  }

  // VALIDATE (mới tích hợp)
  const validateErr = await validateNhanVien(data, id);
  if (validateErr) return { error: validateErr };

  // Nếu là Manager thường → chỉ sửa nhân viên trong phòng mình
  if (scope.role === "manager" && !isKeToan && !isSelfUpdate) {
    const targetPhongBanId = oldData.phong_ban_id;

    if (!targetPhongBanId || !scope.managedDepartmentIds.includes(targetPhongBanId)) {
      return { error: "Bạn không có quyền sửa nhân viên phòng khác." };
    }

    if (data.phong_ban_id && !scope.managedDepartmentIds.includes(Number(data.phong_ban_id))) {
      return { error: "Bạn không thể chuyển nhân viên sang phòng ban khác." };
    }
  }

  // Kiểm tra chức vụ mới nếu có thay đổi
  if (data.chuc_vu_id) {
    const newChucVuId = Number(data.chuc_vu_id);

    const [[cvCheck]]: any = await pool.query(
      `SELECT quyen_mac_dinh FROM chuc_vu WHERE id = ? LIMIT 1`,
      [newChucVuId]
    );
    const roleDefault = cvCheck?.quyen_mac_dinh || "employee";

    if (roleDefault === "manager" || roleDefault === "admin") {
      const [rows]: any = await pool.query(
        `SELECT id FROM nhan_vien 
          WHERE chuc_vu_id = ? AND id <> ? 
          LIMIT 1`,
        [newChucVuId, id]
      );
      if (rows.length > 0) {
        return {
          error:
            "Chức vụ này (quyền " +
            roleDefault +
            ") đã được gán cho một nhân viên khác. Mỗi chức vụ manager/admin chỉ được 1 người.",
        };
      }
    }
  }

  // Xây dựng câu lệnh UPDATE
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
      params.push(data[k] ?? null);
    }
  }

  if (!sets.length) return { ok: true }; // không có gì để cập nhật

  params.push(id);

  // CẬP NHẬT BẢNG NHÂN VIÊN
  const [r]: any = await pool.query(`UPDATE nhan_vien SET ${sets.join(", ")} WHERE id = ?`, params);

  // ==================================================
  // TỰ ĐỘNG CẬP NHẬT TRƯỞNG PHÒNG KHI THAY ĐỔI CHỨC VỤ/PHÒNG BAN
  // =============================================================
  if (r.affectedRows > 0 && ("chuc_vu_id" in data || "phong_ban_id" in data)) {
    try {
      // Lấy ID tài khoản của nhân viên này
      const [[taiKhoan]]: any = await pool.query(
        `SELECT id FROM tai_khoan WHERE nhan_vien_id = ? LIMIT 1`,
        [id]
      );
      const tai_khoan_id = taiKhoan?.id;

      if (tai_khoan_id) {
        // --- XỬ LÝ "MIỄN NHIỆM" TRƯỞNG PHÒNG CŨ ---
        if (oldData.chuc_vu_id && oldData.phong_ban_id) {
          const [[oldChucVu]]: any = await pool.query(
            `SELECT ten_chuc_vu, quyen_mac_dinh FROM chuc_vu WHERE id = ?`,
            [oldData.chuc_vu_id]
          );

          const wasManager = oldChucVu?.quyen_mac_dinh === "manager";
          const wasTruongPhong = oldChucVu?.ten_chuc_vu?.toLowerCase().includes("trưởng phòng");

          if (wasManager && wasTruongPhong) {
            console.log(
              `[UPDATE] Tự động miễn nhiệm Trưởng phòng khỏi phòng ban ID: ${oldData.phong_ban_id}`
            );
            // Chỉ clear nếu người quản lý hiện tại chính là người này
            await pool.query(
              `UPDATE phong_ban SET manager_taikhoan_id = NULL WHERE id = ? AND manager_taikhoan_id = ?`,
              [oldData.phong_ban_id, tai_khoan_id]
            );
          }
        }

        // --- XỬ LÝ "BỔ NHIỆM" TRƯỞNG PHÒNG MỚI ---
        const new_chuc_vu_id = data.chuc_vu_id ?? oldData.chuc_vu_id;
        const new_phong_ban_id = data.phong_ban_id ?? oldData.phong_ban_id;

        if (new_chuc_vu_id && new_phong_ban_id) {
          const [[newChucVu]]: any = await pool.query(
            `SELECT ten_chuc_vu, quyen_mac_dinh FROM chuc_vu WHERE id = ?`,
            [new_chuc_vu_id]
          );

          const isManager = newChucVu?.quyen_mac_dinh === "manager";
          const isTruongPhong = newChucVu?.ten_chuc_vu?.toLowerCase().includes("trưởng phòng");

          if (isManager && isTruongPhong) {
            console.log(
              `[UPDATE] Tự động bổ nhiệm Trưởng phòng cho phòng ban ID: ${new_phong_ban_id}`
            );
            await pool.query(`UPDATE phong_ban SET manager_taikhoan_id = ? WHERE id = ?`, [
              tai_khoan_id,
              new_phong_ban_id,
            ]);
          }
        }
      }
    } catch (error) {
      console.error("Lỗi khi tự động cập nhật trưởng phòng (update):", error);
    }
  }

  // ===========================
  // GỬI THÔNG BÁO NẾU CÓ SỰ THAY ĐỔI
  // ===========================

  // 1️ Thay đổi thông tin cá nhân
  const personalFields = ["ho_ten", "email", "so_dien_thoai", "dia_chi"];

  const hasPersonalChange = personalFields.some(
    (f) => Object.prototype.hasOwnProperty.call(data, f) && (data as any)[f] !== (oldData as any)[f]
  );

  if (hasPersonalChange) {
    await thongBaoService.tao({
      nguoi_nhan_id: id,
      loai: "nhan_su",
      tieu_de: "Thông tin cá nhân của bạn đã được cập nhật",
      noi_dung: "Một số thông tin trong hồ sơ cá nhân của bạn đã được thay đổi.",
      tham_chieu_loai: "nhan_vien",
      tham_chieu_id: id,
      nguoi_tao_id: userId,
    });
  }

  // 2 Thay đổi phòng ban
  if ("phong_ban_id" in data && data.phong_ban_id !== oldData.phong_ban_id) {
    const [[pb]]: any = await pool.query("SELECT ten_phong_ban FROM phong_ban WHERE id=?", [
      data.phong_ban_id,
    ]);

    await thongBaoService.tao({
      nguoi_nhan_id: id,
      loai: "nhan_su",
      tieu_de: "Bạn đã được chuyển phòng ban",
      noi_dung: `Phòng ban mới: ${pb?.ten_phong_ban || "Không xác định"}`,
      tham_chieu_loai: "nhan_vien",
      tham_chieu_id: id,
      nguoi_tao_id: userId,
    });
  }

  // 3️ Thay đổi chức vụ
  if ("chuc_vu_id" in data && data.chuc_vu_id !== oldData.chuc_vu_id) {
    const [[cv]]: any = await pool.query("SELECT ten_chuc_vu FROM chuc_vu WHERE id=?", [
      data.chuc_vu_id,
    ]);

    await thongBaoService.tao({
      nguoi_nhan_id: id,
      loai: "nhan_su",
      tieu_de: "Chức vụ của bạn đã được cập nhật",
      noi_dung: `Chức vụ mới: ${cv?.ten_chuc_vu || "Không xác định"}`,
      tham_chieu_loai: "nhan_vien",
      tham_chieu_id: id,
      nguoi_tao_id: userId,
    });
  }

  // 4️ Thay đổi mật khẩu (chỉ kiểm tra khi có truyền mat_khau)
  if ("mat_khau" in data) {
    await thongBaoService.tao({
      nguoi_nhan_id: id,
      loai: "bao_mat",
      tieu_de: "Mật khẩu tài khoản đã thay đổi",
      noi_dung:
        "Mật khẩu đăng nhập của bạn đã được cập nhật. Nếu bạn không thực hiện thao tác này, vui lòng liên hệ quản trị.",
      tham_chieu_loai: "nhan_vien",
      tham_chieu_id: id,
      nguoi_tao_id: userId,
    });
  }

  return { ok: r.affectedRows > 0 };
};

/** ====================================================================
 *  XÓA NHÂN VIÊN
 *  ==================================================================== */
export const remove = async (req: any, id: number) => {
  const scope = await layPhamViNguoiDung(req);

  // Chỉ ADMIN được xoá (mềm) nhân viên
  if (scope.role !== "admin") {
    return { error: "Chỉ quản trị viên mới có quyền xoá nhân viên." };
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Kiểm tra nhân viên tồn tại và chưa bị xóa
    const [[nv]]: any = await connection.query(
      "SELECT id FROM nhan_vien WHERE id = ? AND da_xoa = 0",
      [id]
    );
    if (!nv) {
      await connection.rollback();
      return { error: "Nhân viên không tồn tại hoặc đã bị xóa." };
    }

    await connection.query(`UPDATE nhan_vien SET da_xoa = 1 WHERE id = ?`, [id]);
    await connection.query(`UPDATE tai_khoan SET trang_thai = 'inactive' WHERE nhan_vien_id = ?`, [
      id,
    ]);

    const [[tk]]: any = await connection.query("SELECT id FROM tai_khoan WHERE nhan_vien_id = ?", [
      id,
    ]);
    if (tk) {
      await connection.query(
        `UPDATE phong_ban SET manager_taikhoan_id = NULL WHERE manager_taikhoan_id = ?`,
        [tk.id]
      );
    }

    await connection.commit();
    return { ok: true };
  } catch (error) {
    await connection.rollback();
    console.error("Lỗi khi xóa nhân viên:", error);
    return { error: "Lỗi hệ thống khi xóa nhân viên." };
  } finally {
    connection.release();
  }
};

// getByChucVu giữ nguyên
export const getByChucVu = async (chuc_vu_id: number) => {
  const [rows]: any = await pool.query(
    `SELECT id, ho_ten, email FROM nhan_vien WHERE chuc_vu_id = ? ORDER BY id DESC`,
    [chuc_vu_id]
  );
  return rows;
};

//Cập nhật riêng số người phụ thuộc
export const updateNguoiPhuThuoc = async (req: any, id: number, so_nguoi_phu_thuoc: number) => {
  const scope = await layPhamViNguoiDung(req);

  const isKeToan = scope.isAccountingManager;

  // Chỉ Admin mới được gọi endpoint này
  if (scope.role !== "admin") {
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

//============= hỗ trợ kiển tra validate ============
const validateNhanVien = async (data: any, idToExclude: number | null = null) => {
  const {
    email,
    so_dien_thoai,
    so_nguoi_phu_thuoc,
    ngay_sinh,
    ngay_vao_lam,
    phong_ban_id,
    chuc_vu_id,
  } = data;

  const isValidDate = (v: any) => {
    const d = new Date(v);
    return v !== undefined && v !== null && String(v).trim() !== "" && !Number.isNaN(d.getTime());
  };

  // 1. Validate Số người phụ thuộc
  if (so_nguoi_phu_thuoc !== undefined) {
    const n = Number(so_nguoi_phu_thuoc);
    if (!Number.isFinite(n)) return "Số người phụ thuộc không hợp lệ.";
    if (n < 0) return "Số người phụ thuộc không được là số âm.";
    if (n > 20) return "Số người phụ thuộc tối đa là 20.";
  }

  // 2. Validate Ngày sinh < Ngày vào làm
  if (ngay_sinh !== undefined && ngay_sinh !== null && String(ngay_sinh).trim() !== "") {
    if (!isValidDate(ngay_sinh)) return "Ngày sinh không hợp lệ.";
  }
  if (ngay_vao_lam !== undefined && ngay_vao_lam !== null && String(ngay_vao_lam).trim() !== "") {
    if (!isValidDate(ngay_vao_lam)) return "Ngày vào làm không hợp lệ.";
  }
  if (isValidDate(ngay_sinh) && isValidDate(ngay_vao_lam)) {
    const dSinh = new Date(ngay_sinh);
    const dLam = new Date(ngay_vao_lam);
    if (dSinh.getTime() >= dLam.getTime()) {
      return "Ngày vào làm phải sau ngày sinh.";
    }
  }

  // 3. Validate Phòng ban tồn tại
  if (phong_ban_id !== undefined && phong_ban_id !== null && phong_ban_id !== "") {
    const [[pb]]: any = await pool.query("SELECT id FROM phong_ban WHERE id = ? LIMIT 1", [
      Number(phong_ban_id),
    ]);
    if (!pb) return "Phòng ban đã chọn không tồn tại.";
  }

  // 4. Validate Chức vụ tồn tại
  if (chuc_vu_id !== undefined && chuc_vu_id !== null && chuc_vu_id !== "") {
    const [[cv]]: any = await pool.query("SELECT id FROM chuc_vu WHERE id = ? LIMIT 1", [
      Number(chuc_vu_id),
    ]);
    if (!cv) return "Chức vụ đã chọn không tồn tại.";
  }

  // 5. Validate Email trùng
  if (email !== undefined && email !== null && String(email).trim() !== "") {
    const e = String(email).trim().toLowerCase();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
    if (!emailOk) return "Email không đúng định dạng.";

    let sql = "SELECT id FROM nhan_vien WHERE LOWER(email) = ? AND da_xoa = 0";
    const params: any[] = [e];

    if (idToExclude) {
      sql += " AND id != ?";
      params.push(idToExclude);
    }

    const [[duplicate]]: any = await pool.query(sql + " LIMIT 1", params);
    if (duplicate) return `Email "${e}" đã được sử dụng bởi nhân viên khác.`;
  }

  // 6. Validate SĐT trùng
  if (
    so_dien_thoai !== undefined &&
    so_dien_thoai !== null &&
    String(so_dien_thoai).trim() !== ""
  ) {
    const p = String(so_dien_thoai).trim();
    const phoneOk = /^[0-9]{9,15}$/.test(p);
    if (!phoneOk) return "Số điện thoại không đúng định dạng (chỉ gồm số, 9-15 ký tự).";

    let sql = "SELECT id FROM nhan_vien WHERE so_dien_thoai = ? AND da_xoa = 0";
    const params: any[] = [p];

    if (idToExclude) {
      sql += " AND id != ?";
      params.push(idToExclude);
    }

    const [[duplicate]]: any = await pool.query(sql + " LIMIT 1", params);
    if (duplicate) return `Số điện thoại "${p}" đã được sử dụng bởi nhân viên khác.`;
  }

  return null;
};

// ======================
// XUẤT EXCEL DANH SÁCH NHÂN VIÊN
// ======================
export const exportExcel = async (req: any, res: any) => {
  const search = (req.query.search as string) || "";
  const chucVuId = Number(req.query.chuc_vu_id) || null;
  const phongBanId = Number(req.query.phong_ban_id) || null;

  const scope = await layPhamViNguoiDung(req);
  const isSuperUser = scope.role === "admin" || scope.isAccountingManager;

  const where: string[] = ["nv.da_xoa = 0"];
  const params: any[] = [];

  if (search) {
    where.push(`(nv.ho_ten LIKE ? OR nv.email LIKE ? OR nv.so_dien_thoai LIKE ?)`);
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (chucVuId) {
    where.push(`nv.chuc_vu_id = ?`);
    params.push(chucVuId);
  }
  if (!isSuperUser && phongBanId) {
    where.push(`nv.phong_ban_id = ?`);
    params.push(phongBanId);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;

  const [rows]: any = await pool.query(
    `SELECT nv.*, pb.ten_phong_ban, cv.ten_chuc_vu
     FROM nhan_vien nv
     LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
     LEFT JOIN chuc_vu   cv ON cv.id = nv.chuc_vu_id
     ${whereSql}
     ORDER BY nv.id DESC`,
    params
  );

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("NhanVien");

  sheet.columns = [
    { header: "ID", key: "id", width: 8 },
    { header: "Họ tên", key: "ho_ten", width: 25 },
    { header: "Giới tính", key: "gioi_tinh", width: 10 },
    { header: "Ngày sinh", key: "ngay_sinh", width: 15 },
    { header: "Email", key: "email", width: 25 },
    { header: "SĐT", key: "so_dien_thoai", width: 15 },
    { header: "Địa chỉ", key: "dia_chi", width: 30 },
    { header: "Phòng ban", key: "ten_phong_ban", width: 20 },
    { header: "Chức vụ", key: "ten_chuc_vu", width: 20 },
    { header: "Ngày vào làm", key: "ngay_vao_lam", width: 15 },
    { header: "Trạng thái", key: "trang_thai", width: 15 },
    { header: "Số người phụ thuộc", key: "so_nguoi_phu_thuoc", width: 18 },
    { header: "Ghi chú", key: "ghi_chu", width: 30 },
  ];

  const statusMap: any = {
    dang_lam: "Đang làm",
    tam_nghi: "Tạm nghỉ",
    da_nghi: "Đã nghỉ",
  };

  rows.forEach((r: any) => {
    sheet.addRow({
      id: r.id,
      ho_ten: r.ho_ten,
      gioi_tinh: r.gioi_tinh,
      ngay_sinh: r.ngay_sinh ? new Date(r.ngay_sinh) : null,
      email: r.email,
      so_dien_thoai: r.so_dien_thoai,
      dia_chi: r.dia_chi,
      ten_phong_ban: r.ten_phong_ban,
      ten_chuc_vu: r.ten_chuc_vu,
      ngay_vao_lam: r.ngay_vao_lam ? new Date(r.ngay_vao_lam) : null,
      trang_thai: statusMap[r.trang_thai] || r.trang_thai,
      so_nguoi_phu_thuoc: r.so_nguoi_phu_thuoc ?? 0,
      ghi_chu: r.ghi_chu,
    });
  });

  // Định dạng cột ngày
  ["ngay_sinh", "ngay_vao_lam"].forEach((key) => {
    const col = sheet.getColumn(key);
    col.numFmt = "dd/mm/yyyy";
  });

  // Header in đậm
  sheet.getRow(1).font = { bold: true };

  const fileName = `nhan_vien_${new Date().toISOString().slice(0, 10)}.xlsx`;

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

  await workbook.xlsx.write(res);
  res.end();
};

export const getOverviewByNhanVienId = async (req: any, nhan_vien_id: number) => {
  const scope = await layPhamViNguoiDung(req);
  const isKeToan = scope.isAccountingManager;
  const isSuperUser = scope.role === "admin" || isKeToan;

  // 1. Kiểm tra nhân viên tồn tại và phạm vi xem
  const [rowsNv]: any = await pool.query(
    `SELECT nv.*, pb.ten_phong_ban, cv.ten_chuc_vu
     FROM nhan_vien nv
     LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
     LEFT JOIN chuc_vu   cv ON cv.id = nv.chuc_vu_id
     WHERE nv.id = ? AND nv.da_xoa = 0 LIMIT 1`,
    [nhan_vien_id]
  );

  const nv = rowsNv[0];
  if (!nv) return { error: "Không tìm thấy nhân viên" };

  if (!isSuperUser) {
    if (scope.role === "employee" && scope.employeeId !== nv.id) {
      return { error: "Bạn không có quyền xem nhân viên này" };
    }
    if (scope.role === "manager" && !scope.managedDepartmentIds.includes(nv.phong_ban_id)) {
      return { error: "Bạn không có quyền xem nhân viên phòng khác" };
    }
  }

  // 2. Hợp đồng đang hoạt động
  const [rowsHD]: any = await pool.query(
    `SELECT *
     FROM hop_dong
     WHERE nhan_vien_id = ? AND trang_thai = 'con_hieu_luc'
     ORDER BY ngay_bat_dau DESC
     LIMIT 1`,
    [nhan_vien_id]
  );
  const hop_dong = rowsHD[0] || null;

  // 3. Chấm công tháng hiện tại
  const now = new Date();
  const thang = Number(req.query.thang) || now.getMonth() + 1;
  const nam = Number(req.query.nam) || now.getFullYear();

  const [rowsChamCong]: any = await pool.query(
    `SELECT *
     FROM cham_cong
     WHERE nhan_vien_id = ?
       AND MONTH(ngay_lam) = ?
       AND YEAR(ngay_lam) = ?
     ORDER BY ngay_lam ASC`,
    [nhan_vien_id, thang, nam]
  );

  // 4. Phụ cấp tháng hiện tại
  const [rowsPhuCap]: any = await pool.query(
    `SELECT *
   FROM phu_cap_chi_tiet
   WHERE nhan_vien_id = ?
     AND thang = ?
     AND nam = ?`,
    [nhan_vien_id, thang, nam]
  );
  const phu_cap = rowsPhuCap;

  // 5. Lương tháng hiện tại
  const [rowsLuong]: any = await pool.query(
    `SELECT *
     FROM luong
     WHERE nhan_vien_id = ?
       AND thang = ?
       AND nam = ?
     LIMIT 1`,
    [nhan_vien_id, thang, nam]
  );
  const luong = rowsLuong[0] || null;

  // 6. Thưởng phạt tháng hiện tại
  const [rowsThuongPhat]: any = await pool.query(
    `SELECT *
   FROM thuong_phat
   WHERE nhan_vien_id = ?
     AND thang = ?
     AND nam = ?
   ORDER BY ngay_tao DESC`,
    [nhan_vien_id, thang, nam]
  );
  const thuong_phat = rowsThuongPhat;

  return {
    nhan_vien: nv,
    hop_dong,
    cham_cong: rowsChamCong,
    phu_cap,
    luong,
    thuong_phat,
    thang,
    nam,
  };
};
