//taiKhoanService.ts
import { Request } from "express";
import { pool } from "../db";
import bcrypt from "bcryptjs";
import { TaiKhoan } from "../models/taiKhoan";
import { removeVietnameseTones } from "../utils/xoa-dau-tai-khoan";

// ================== LẤY DANH SÁCH ==================
export const getAll = async (req: Request) => {
  // 1. Lấy tham số từ Query String
  const { page = 1, limit = 20, search, chuc_vu_id, trang_thai } = req.query as any;

  const offset = (Number(page) - 1) * Number(limit);

  // 2. Xây dựng điều kiện lọc (Dynamic WHERE)
  const where: string[] = [];
  const params: any[] = [];

  // Lọc theo tên đăng nhập hoặc tên nhân viên
  if (search) {
    where.push("(tk.ten_dang_nhap LIKE ? OR nv.ho_ten LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  // Lọc theo chức vụ
  if (chuc_vu_id) {
    where.push("nv.chuc_vu_id = ?");
    params.push(chuc_vu_id);
  }

  // Lọc theo trạng thái
  if (trang_thai) {
    if (trang_thai === "1") {
      where.push("tk.trang_thai = 'active'");
    } else if (trang_thai === "0") {
      where.push("tk.trang_thai != 'active'");
    }
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  // 3. Đếm tổng số bản ghi (SỬA LỖI Ở ĐÂY)
  // Thay vì [[{ total }]], ta lấy mảng rows ra trước rồi mới truy cập thuộc tính
  const [countResult]: any = await pool.query(
    `SELECT COUNT(*) as total 
     FROM tai_khoan tk
     LEFT JOIN nhan_vien nv ON nv.id = tk.nhan_vien_id
     LEFT JOIN chuc_vu cv ON cv.id = nv.chuc_vu_id 
     ${whereClause}`,
    params
  );

  // Lấy giá trị total an toàn, nếu không có thì mặc định là 0
  const total = countResult[0]?.total || 0;

  // 4. Lấy dữ liệu chi tiết
  const [rows]: any = await pool.query(
    `
    SELECT tk.*, nv.ho_ten, cv.ten_chuc_vu, pb.ten_phong_ban
    FROM tai_khoan tk
    LEFT JOIN nhan_vien nv ON nv.id = tk.nhan_vien_id
    LEFT JOIN chuc_vu cv ON cv.id = nv.chuc_vu_id 
    LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
    ${whereClause}
    ORDER BY tk.id DESC
    LIMIT ? OFFSET ?
    `,
    [...params, Number(limit), Number(offset)]
  );

  // 5. Trả về format chuẩn
  return {
    items: rows,
    total,
    page: Number(page),
    limit: Number(limit),
  };
};

// ================== LẤY THEO ID ==================
export const getById = async (id: number) => {
  const [[row]]: any = await pool.query(
    `
    SELECT tk.*, nv.ho_ten, cv.ten_chuc_vu, pb.ten_phong_ban
    FROM tai_khoan tk
    LEFT JOIN nhan_vien nv ON nv.id = tk.nhan_vien_id
    LEFT JOIN chuc_vu cv ON cv.id = nv.chuc_vu_id 
    LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
    WHERE tk.id = ?
    LIMIT 1
  `,
    [id]
  );
  return row || null;
};

//===================== hiển thị cho Nhân Viên ID =================
export const getByNhanVienId = async (nhan_vien_id: number) => {
  const [[row]]: any = await pool.query(
    `
    SELECT tk.*, nv.ho_ten, cv.ten_chuc_vu, pb.ten_phong_ban
    FROM tai_khoan tk
    LEFT JOIN nhan_vien nv ON nv.id = tk.nhan_vien_id
    LEFT JOIN chuc_vu cv ON cv.id = nv.chuc_vu_id 
    LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
    WHERE tk.nhan_vien_id = ?
    LIMIT 1
  `,
    [nhan_vien_id]
  );
  return row || null;
};

//============== Đổi mật khẩu =========================
export const updatePassword = async (
  taikhoan_id: number,
  mat_khau_cu: string,
  mat_khau_moi: string
) => {
  // 1. Lấy tài khoản
  const [[tk]]: any = await pool.query(`SELECT * FROM tai_khoan WHERE id = ? LIMIT 1`, [
    taikhoan_id,
  ]);
  if (!tk) return { error: "Không tìm thấy tài khoản" };

  // 2. So khớp mật khẩu cũ
  const ok = await bcrypt.compare(mat_khau_cu.trim(), tk.mat_khau);
  if (!ok) return { error: "Mật khẩu cũ không đúng" };

  // 3. Hash mật khẩu mới
  const hashed = await bcrypt.hash(mat_khau_moi.trim(), 10);

  // 4. Cập nhật
  await pool.query(`UPDATE tai_khoan SET mat_khau = ? WHERE id = ?`, [hashed, taikhoan_id]);

  return { ok: true, message: "Đổi mật khẩu thành công" };
};

// ================== TẠO TÀI KHOẢN ==================
export const create = async (body: TaiKhoan) => {
  const { nhan_vien_id, ten_dang_nhap, mat_khau, trang_thai } = body;

  if (!nhan_vien_id || !ten_dang_nhap) {
    return { error: "Thiếu thông tin bắt buộc" };
  }

  // 1. Kiểm tra trùng username (Tránh lỗi UNIQUE ten_dang_nhap)
  const [[existsUser]]: any = await pool.query(
    "SELECT id FROM tai_khoan WHERE ten_dang_nhap = ? LIMIT 1",
    [ten_dang_nhap]
  );
  if (existsUser) return { error: "Tên đăng nhập đã tồn tại" };

  // 2. Kiểm tra nhân viên này đã có tài khoản chưa
  const [[existsNV]]: any = await pool.query(
    "SELECT id FROM tai_khoan WHERE nhan_vien_id = ? LIMIT 1",
    [nhan_vien_id]
  );
  if (existsNV) {
    return { error: "Nhân viên này đã được cấp tài khoản trước đó." };
  }

  // Mã hoá mật khẩu bằng bcrypt
  const hashedPassword = await bcrypt.hash(mat_khau?.trim() || "123456", 10);

  // 3. Thực hiện chèn dữ liệu
  const [r]: any = await pool.query(
    `
    INSERT INTO tai_khoan (nhan_vien_id, ten_dang_nhap, mat_khau, trang_thai)
    VALUES (?, ?, ?, ?)
  `,
    [nhan_vien_id, ten_dang_nhap, hashedPassword, trang_thai || "active"]
  );

  return { id: r.insertId };
};

// ================== TẠO TỰ ĐỘNG KHI THÊM NHÂN VIÊN ==================
export const createDefaultForNhanVien = async (nhan_vien_id: number, ho_ten: string) => {
  const username = removeVietnameseTones(ho_ten).toLowerCase().replace(/\s+/g, "");

  const hashed = await bcrypt.hash("123456", 10);

  const [r]: any = await pool.query(
    `
    INSERT INTO tai_khoan (nhan_vien_id, ten_dang_nhap, mat_khau, trang_thai)
    VALUES (?, ?, ?, 'active')
  `,
    [nhan_vien_id, username, hashed]
  );

  return { id: r.insertId, username };
};

// ================== DANH SÁCH TÀI KHOẢN ĐỂ CHỌN TRƯỞNG PHÒNG ==================
export const getForManagerSelect = async (phong_ban_id?: number) => {
  const params: any[] = [];
  let where = "WHERE tk.trang_thai = 'active'";

  if (phong_ban_id) {
    where += " AND nv.phong_ban_id = ?";
    params.push(phong_ban_id);
  }

  const [rows]: any = await pool.query(
    `
    SELECT 
      tk.id AS tai_khoan_id,
      nv.id AS nhan_vien_id,
      nv.ho_ten,
      cv.ten_chuc_vu,
      pb.ten_phong_ban
    FROM tai_khoan tk
    JOIN nhan_vien nv ON nv.id = tk.nhan_vien_id
    LEFT JOIN chuc_vu cv ON cv.id = nv.chuc_vu_id
    LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
    ${where}
    ORDER BY nv.ho_ten ASC
    `,
    params
  );
  return rows;
};

// ================== CẬP NHẬT ==================
export const update = async (id: number, body: Partial<TaiKhoan>) => {
  const { ten_dang_nhap, mat_khau, trang_thai } = body; // Bỏ chuc_vu_id

  // Nếu có thay đổi mật khẩu → hash lại
  const hashed = mat_khau ? await bcrypt.hash(mat_khau.trim(), 10) : undefined;

  const [r]: any = await pool.query(
    `
    UPDATE tai_khoan
    SET ten_dang_nhap = ?, 
      ${hashed ? "mat_khau = ?," : ""}
      trang_thai = ?
    WHERE id = ?
  `,
    hashed
      ? [ten_dang_nhap, hashed, trang_thai || "active", id] // Bỏ chuc_vu_id
      : [ten_dang_nhap, trang_thai || "active", id] // Bỏ chuc_vu_id
  );

  if (!r.affectedRows) return { error: "Không tìm thấy tài khoản" };
  return { ok: true };
};

// ================== XOÁ ==================
export const remove = async (id: number) => {
  const [r]: any = await pool.query("DELETE FROM tai_khoan WHERE id = ?", [id]);
  if (!r.affectedRows) return { error: "Không tìm thấy tài khoản để xóa" };
  return { message: "Đã xóa tài khoản" };
};

// ================== ĐĂNG NHẬP ==================
export const login = async (username: string, password: string) => {
  const [[row]]: any = await pool.query(
    `
    SELECT tk.*, nv.ho_ten, cv.ten_chuc_vu
    FROM tai_khoan tk
    LEFT JOIN nhan_vien nv ON nv.id = tk.nhan_vien_id
    LEFT JOIN chuc_vu cv ON cv.id = nv.chuc_vu_id 
    WHERE tk.ten_dang_nhap = ?
    LIMIT 1
  `,
    [username]
  );

  if (!row) return { error: "Sai tài khoản hoặc mật khẩu" };

  const ok = await bcrypt.compare(password.trim(), String(row.mat_khau).trim());
  if (!ok) return { error: "Sai tài khoản hoặc mật khẩu" };

  return row;
};
