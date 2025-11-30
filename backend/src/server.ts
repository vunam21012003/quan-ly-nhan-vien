// src/server.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import path from "path";
import cron from "node-cron";
import { autoCopyAllowance } from "./services/phuCapAutoCopy";

import phongBanRoutes from "./routes/phongBanRoutes";
import chucvuRoutes from "./routes/chucvuRoutes";
import nhanVienRoutes from "./routes/nhanVienRoutes";
import chamCongRoutes from "./routes/chamCongRoutes";
import hopDongRoutes from "./routes/hopDongRoutes";
import luongRoutes from "./routes/luongRoutes";
import lichSuTraLuongRoutes from "./routes/lichSuTraLuongRoutes";
import phanTichCongRoutes from "./routes/phanTichCongRoutes";
import taiKhoanRoutes from "./routes/taiKhoanRoutes";
import baoCaoLuongRoutes from "./routes/baoCaoLuongRoutes";
import authRoutes from "./routes/auth";
import thuongPhatRoutes from "./routes/thuongPhatRoutes";
import trangChinhRoutes from "./routes/trangChinhRoutes";
import phuCapLoaiRoutes from "./routes/phuCapLoaiRoutes";
import phuCapThangRoutes from "./routes/phuCapThangRoutes";
import uploadRoutes from "./routes/upload";
import donNghiPhepRoutes from "./routes/donNghiPhepRoutes";

import ngayLeRoutes from "./routes/ngayLeRoutes";
import phanCongLamBuRoutes from "./routes/phanCongLamBuRoutes";
import "./scripts/capNhatHopDongHetHan";
import luongPayRoutes from "./routes/luongPayRoutes";

import { requireAuth, requireRole } from "./middlewares/auth";
import { pool } from "./db";

const app = express();

// Chạy 00:05 sáng ngày 1 mỗi tháng
cron.schedule("5 0 1 * *", async () => {
  console.log("🔄 Đang tự động sao chép phụ cấp tháng mới...");
  const rs = await autoCopyAllowance();
  console.log(`✅ Đã sao chép ${rs.copied} phụ cấp.`);
});

/* ----------------------------------------------
 * 🔒 Cấu hình bảo mật Helmet
 * ---------------------------------------------- */
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-inline'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "blob:"],
        "connect-src": ["'self'"],
        "script-src-attr": ["'unsafe-inline'"],
      },
    },
  })
);

/* ----------------------------------------------
 * 🌐 Cấu hình CORS
 * ---------------------------------------------- */
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

/* ----------------------------------------------
 * 🧩 Routes công khai
 * ---------------------------------------------- */

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/ngay-le", ngayLeRoutes);

/* ----------------------------------------------
 * 🖥️ Serve static HTML/CSS/JS từ frontend/public
 * ---------------------------------------------- */
const publicDir = path.join(__dirname, "..", "..", "frontend", "public");
app.use(express.static(publicDir));

app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

/* ----------------------------------------------
 * 🩺 Health check & Debug DB
 * ---------------------------------------------- */
app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/__health/db", async (_req, res) => {
  try {
    const [rows] = await pool.query("SELECT 1 AS ok");
    res.json({ ok: true, rows });
  } catch (err: any) {
    res.status(500).json({
      ok: false,
      code: err?.code,
      errno: err?.errno,
      sqlMessage: err?.sqlMessage,
    });
  }
});

app.get("/__debug/db", async (_req, res) => {
  try {
    const [rows]: any = await pool.query("SELECT DATABASE() AS dbname");
    res.json({ dbname: rows?.[0]?.dbname });
  } catch (e: any) {
    res.status(500).json({ error: e?.message });
  }
});

/* ----------------------------------------------
 * 🔐 API chính có xác thực
 * ---------------------------------------------- */

// ✅ Đăng nhập, đăng ký, đổi mật khẩu
app.use("/auth", authRoutes);

// ✅ Quản lý danh mục cơ bản
app.use("/phong-ban", phongBanRoutes);
app.use("/chuc-vu", chucvuRoutes);
app.use("/phan-cong-lam-bu", phanCongLamBuRoutes);
// ✅ Quản lý thưởng phạt
app.use(
  "/thuong-phat",
  requireAuth,
  requireRole(["admin", "manager", "employee"]),
  thuongPhatRoutes
);

// ✅ Nhân viên (CRUD + auto tạo tài khoản)
app.use("/nhan-vien", requireAuth, requireRole(["admin", "manager", "employee"]), nhanVienRoutes);
// Serve static uploads
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// API upload ảnh
app.use("/upload", uploadRoutes);

// ✅ Chấm công, hợp đồng, lương
app.use("/cham-cong", requireAuth, requireRole(["admin", "manager", "employee"]), chamCongRoutes);
app.use("/hop-dong", requireAuth, requireRole(["admin", "manager", "employee"]), hopDongRoutes);
app.use("/luong", requireAuth, requireRole(["admin", "manager"]), luongRoutes);

//nghỉ phép
app.use("/don-nghi-phep", donNghiPhepRoutes);

// ✅ Lịch sử trả lương, báo cáo, phân tích công
app.use("/lich-su-tra-luong", requireAuth, requireRole(["admin", "manager"]), lichSuTraLuongRoutes);
app.use("/bao-cao", requireAuth, requireRole(["admin", "manager"]), baoCaoLuongRoutes);
app.use("/phan-tich-cong", requireAuth, requireRole(["admin", "manager"]), phanTichCongRoutes);
app.use("/tra-luong", requireAuth, requireRole(["admin", "manager"]), luongPayRoutes);

// ✅ Tài khoản (Admin + Manager kế toán)
app.use("/tai-khoan", requireAuth, requireRole(["admin", "manager"]), taiKhoanRoutes);

app.use("/phu-cap-loai", requireAuth, requireRole(["admin", "manager"]), phuCapLoaiRoutes);
app.use(
  "/phu-cap-thang",
  requireAuth,
  requireRole(["admin", "manager", "employee"]),
  phuCapThangRoutes
);

// trang chính
app.use("/api/trang-chinh", trangChinhRoutes);
/* ----------------------------------------------
 * ⚠️ Xử lý lỗi & 404
 * ---------------------------------------------- */
app.use((_req, res) => res.status(404).json({ message: "Endpoint không tồn tại" }));

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("🔥 SERVER ERROR:", err);
  res.status(err?.status || 500).json({ message: err?.message || "Lỗi máy chủ" });
});

/* ----------------------------------------------
 * 🚀 Khởi động server
 * ---------------------------------------------- */
const PORT = Number(process.env.PORT || 8001);
app.listen(PORT, () => console.log(`✅ HR server running at http://localhost:${PORT}`));

export default app;
