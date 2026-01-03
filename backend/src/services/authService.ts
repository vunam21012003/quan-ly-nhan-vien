// authService.ts
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db";
import { sendEmail } from "../utils/sendMail";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

// ===================== REGISTER =====================
export const register = async (body: any) => {
  try {
    const { username, password, nhan_vien_id } = body || {};
    if (!username || !password) {
      return { error: "Thiếu tên đăng nhập hoặc mật khẩu", status: 400 };
    }

    // Kiểm tra trùng tên đăng nhập
    const [exist] = await pool.query(`SELECT id FROM tai_khoan WHERE ten_dang_nhap = ? LIMIT 1`, [
      username,
    ]);
    if ((exist as any[]).length > 0) {
      return { error: "Tên đăng nhập đã tồn tại", status: 409 };
    }

    // Mã hoá mật khẩu
    const hashed = await bcrypt.hash(password.trim(), 10);

    // Tạo tài khoản
    const [r]: any = await pool.execute(
      `INSERT INTO tai_khoan (ten_dang_nhap, mat_khau, nhan_vien_id, trang_thai)
       VALUES (?, ?, ?, 'active')`,
      [username, hashed, nhan_vien_id || null]
    );

    return { data: { id: r.insertId, message: "Tạo tài khoản thành công" } };
  } catch (err) {
    console.error("Register error:", err);
    return { error: "Server error", status: 500 };
  }
};

// ===================== LOGIN =====================
export const login = async (body: any) => {
  try {
    const { username, password } = body || {};
    if (!username || !password) {
      return { error: "Thiếu tên đăng nhập hoặc mật khẩu", status: 400 };
    }

    // Lấy thông tin tài khoản + TRẠNG THÁI + quyền
    const [rows]: any = await pool.query(
      `
      SELECT 
        tk.id, tk.ten_dang_nhap, tk.mat_khau, tk.nhan_vien_id, 
        tk.trang_thai, 
        nv.ho_ten, cv.ten_chuc_vu, cv.quyen_mac_dinh AS role
      FROM tai_khoan tk
      LEFT JOIN nhan_vien nv ON tk.nhan_vien_id = nv.id
      LEFT JOIN chuc_vu cv ON nv.chuc_vu_id = cv.id
      WHERE tk.ten_dang_nhap = ?
      LIMIT 1
      `,
      [username]
    );

    const userRow = (rows as any[])[0];

    // 1. Kiểm tra tài khoản có tồn tại không
    if (!userRow) {
      return { error: "Sai tên đăng nhập hoặc mật khẩu", status: 401 };
    }

    // 2. KIỂM TRA TRẠNG THÁI
    if (userRow.trang_thai !== "active") {
      return {
        error: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.",
        status: 403,
      };
    }

    // 3. Kiểm tra mật khẩu
    const ok = await bcrypt.compare(password.trim(), String(userRow.mat_khau).trim());
    if (!ok) {
      return { error: "Sai tên đăng nhập hoặc mật khẩu", status: 401 };
    }

    // Lấy quyền từ chức vụ
    const role = userRow.role || "employee";

    // Tạo JWT
    const token = jwt.sign(
      {
        id: userRow.id,
        username: userRow.ten_dang_nhap,
        nhan_vien_id: userRow.nhan_vien_id,
        role,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Dữ liệu trả về
    const user = {
      id: userRow.id,
      username: userRow.ten_dang_nhap,
      nhan_vien_id: userRow.nhan_vien_id,
      ho_ten: userRow.ho_ten,
      chuc_vu: userRow.ten_chuc_vu,
      role,
    };

    return { data: { token, user } };
  } catch (err) {
    console.error("Login error:", err);
    return { error: "Server error", status: 500 };
  }
};

// ===================== CHANGE PASSWORD =====================
export const changePassword = async (userId: number, body: any) => {
  try {
    const { old_password, new_password } = body || {};
    if (!old_password || !new_password) {
      return { error: "Thiếu mật khẩu cũ hoặc mới", status: 400 };
    }

    // Lấy mật khẩu hiện tại
    const [rows] = await pool.query(`SELECT mat_khau FROM tai_khoan WHERE id = ? LIMIT 1`, [
      userId,
    ]);
    const current = (rows as any[])[0]?.mat_khau;
    if (!current) return { error: "Không tìm thấy tài khoản", status: 404 };

    // So sánh mật khẩu cũ
    const match = await bcrypt.compare(old_password.trim(), String(current).trim());
    if (!match) return { error: "Mật khẩu cũ không đúng", status: 401 };

    // Cập nhật mật khẩu mới
    const hashed = await bcrypt.hash(new_password.trim(), 10);
    await pool.execute(`UPDATE tai_khoan SET mat_khau = ? WHERE id = ?`, [hashed, userId]);

    return { data: { message: "Đổi mật khẩu thành công" } };
  } catch (err) {
    console.error("Change password error:", err);
    return { error: "Server error", status: 500 };
  }
};

// ===================== FORGOT PASSWORD =====================
export const forgotPassword = async (body: any) => {
  try {
    const { username } = body || {};
    if (!username) {
      return { error: "Thiếu tên đăng nhập", status: 400 };
    }

    // Tìm tài khoản + email nhân viên
    const [rows]: any = await pool.query(
      `
      SELECT 
        tk.id,
        tk.ten_dang_nhap,
        tk.nhan_vien_id,
        tk.trang_thai,
        nv.ho_ten,
        nv.email
      FROM tai_khoan tk
      LEFT JOIN nhan_vien nv ON tk.nhan_vien_id = nv.id
      WHERE tk.ten_dang_nhap = ?
      LIMIT 1
      `,
      [username]
    );

    const userRow = rows && rows[0];

    // Không tiết lộ tài khoản có tồn tại hay không
    if (!userRow || !userRow.email) {
      return {
        data: {
          message: "Nếu tài khoản tồn tại, hệ thống đã gửi mật khẩu mới tới email đã đăng ký.",
        },
      };
    }

    // 1. Sinh mật khẩu mới
    const newPassword = generateRandomPassword(10);
    // 2. Mã hoá bằng bcrypt
    const hashed = await bcrypt.hash(newPassword.trim(), 10);

    // 3. Cập nhật vào bảng tai_khoan
    await pool.execute(`UPDATE tai_khoan SET mat_khau = ? WHERE id = ?`, [hashed, userRow.id]);

    // 4. Gửi email
    const tenHienThi = userRow.ho_ten || userRow.ten_dang_nhap;
    const subject = "Đặt lại mật khẩu tài khoản HR System";
    const text = [
      `Xin chào ${tenHienThi},`,
      "",
      "Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản HR System.",
      "",
      `Tên đăng nhập: ${userRow.ten_dang_nhap}`,
      `Mật khẩu mới: ${newPassword}`,
      "",
      "Vui lòng đăng nhập và đổi mật khẩu ngay sau khi vào hệ thống.",
      "",
      "Trân trọng,",
      "HR System",
    ].join("\n");

    await sendEmail({
      to: userRow.email,
      subject,
      text,
      attachments: [],
    });

    return {
      data: {
        message: "Nếu tài khoản tồn tại, hệ thống đã gửi mật khẩu mới tới email đã đăng ký.",
      },
    };
  } catch (err) {
    console.error("Forgot password error:", err);
    return { error: "Server error", status: 500 };
  }
};

function generateRandomPassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*";
  let pwd = "";
  for (let i = 0; i < length; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}
