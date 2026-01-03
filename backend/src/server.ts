import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import path from "path";
import cron from "node-cron";

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
import { xuLyHopDongTuDong } from "./scripts/capNhatHopDongHetHan";
import { xuLyTuDongChamCong } from "./scripts/autoChamCong";
import { capNhatPhanTichCong } from "./services/phanTichCongService";

import luongPayRoutes from "./routes/luongPayRoutes";
import thongBaoRoutes from "./routes/thongBaoRoutes";

import { requireAuth, requireRole } from "./middlewares/auth";
import { pool } from "./db";

const app = express();

// ============================================================
// CRON JOBS TỰ ĐỘNG HÀNG NGÀY / HÀNG THÁNG
// ============================================================

// 01:00 AM - Chấm công tự động (ngày hôm qua)
cron.schedule(
  "00 1 * * *",
  async () => {
    console.log("\n[CRON] Bắt đầu chấm công tự động...");
    try {
      const result = await xuLyTuDongChamCong();
      console.log(`[CRON] Chấm công hoàn tất: ${result.processedCount} nhân viên`);
    } catch (error) {
      console.error("[CRON] Lỗi chấm công:", error);
    }
  },
  {
    timezone: "Asia/Ho_Chi_Minh",
    name: "auto-attendance",
  }
);

// 01:30 AM - Phân tích công tháng hiện tại
cron.schedule(
  "00 1 * * *",
  async () => {
    console.log("\n[CRON] Bắt đầu phân tích công tháng...");
    try {
      const yesterday = new Date(Date.now() - 86400000);
      const dateString = yesterday.toISOString().slice(0, 10);

      const [employees]: any = await pool.query(
        "SELECT id FROM nhan_vien WHERE trang_thai = 'dang_lam'"
      );

      console.log(`Đang phân tích cho ngày: ${dateString}`);

      for (const emp of employees) {
        await capNhatPhanTichCong(emp.id, dateString);
      }

      console.log(`[CRON] Phân tích hoàn tất: ${employees.length} nhân viên`);
    } catch (error) {
      console.error("[CRON] Lỗi phân tích công:", error);
    }
  },
  {
    timezone: "Asia/Ho_Chi_Minh",
    name: "auto-analytics",
  }
);

// 01:45 AM - Xử lý Hợp đồng
cron.schedule(
  "45 1 * * *",
  async () => {
    console.log("\n[CRON] Bắt đầu xử lý tự động Hợp đồng (Cập nhật & Cảnh báo)...");
    try {
      await xuLyHopDongTuDong();
      console.log(`[CRON] Xử lý Hợp đồng hoàn tất.`);
    } catch (error) {
      console.error("[CRON] Lỗi xử lý Hợp đồng:", error);
    }
  },
  {
    timezone: "Asia/Ho_Chi_Minh",
    name: "auto-contract-processing",
  }
);

// ============================================================
// ENDPOINTS TEST
// ============================================================
if (process.env.NODE_ENV === "development") {
  // Test chấm công
  app.post("/__test/auto-cham-cong", async (req, res) => {
    const { ngay, endOfDay } = req.body;
    const rs = await xuLyTuDongChamCong(ngay, endOfDay);
    res.json(rs);
  });

  // Test phân tích công
  app.post("/__test/phan-tich-cong", async (req, res) => {
    const { nhan_vien_id, ngay } = req.body;
    await capNhatPhanTichCong(nhan_vien_id, ngay);
    res.json({ success: true });
  });

  // Test hợp đồng
  app.post("/__test/update-contracts", async (req, res) => {
    // 💡 GỌI HÀM MỚI
    await xuLyHopDongTuDong();
    res.json({ message: "Xử lý hợp đồng tự động đã hoàn tất (Cập nhật và Cảnh báo)." });
  });
}

/* ----------------------------------------------
 * Cấu hình bảo mật Helmet
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
 * Cấu hình CORS
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
 * Routes công khai
 * ---------------------------------------------- */

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

/* ----------------------------------------------
 * Serve static HTML/CSS/JS từ frontend/public
 * ---------------------------------------------- */
const publicDir = path.join(__dirname, "..", "..", "frontend", "public");
app.use(express.static(publicDir));

app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

/* ----------------------------------------------
 * Health check & Debug DB
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
 * API chính có xác thực
 * ---------------------------------------------- */

// Đăng nhập, đăng ký, đổi mật khẩu
app.use("/auth", authRoutes);

// Quản lý danh mục cơ bản
app.use("/phong-ban", phongBanRoutes);
app.use("/chuc-vu", chucvuRoutes);
// Quản lý thưởng phạt
app.use(
  "/thuong-phat",
  requireAuth,
  requireRole(["admin", "manager", "employee"]),
  thuongPhatRoutes
);

// Nhân viên (CRUD + auto tạo tài khoản)
app.use("/nhan-vien", requireAuth, nhanVienRoutes);
// Serve static uploads
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// API upload ảnh
app.use("/upload", uploadRoutes);

// Chấm công, hợp đồng, lương
app.use("/cham-cong", requireAuth, requireRole(["admin", "manager", "employee"]), chamCongRoutes);
app.use("/hop-dong", requireAuth, requireRole(["admin", "manager", "employee"]), hopDongRoutes);
app.use("/luong", requireAuth, requireRole(["admin", "manager"]), luongRoutes);

//nghỉ phép
app.use("/don-nghi-phep", donNghiPhepRoutes);

//thông báo
app.use("/thong-bao", requireAuth, thongBaoRoutes);

// Lịch sử trả lương, báo cáo, phân tích công
app.use("/lich-su-tra-luong", requireAuth, requireRole(["admin", "manager"]), lichSuTraLuongRoutes);
app.use("/bao-cao", requireAuth, requireRole(["admin", "manager", "employee"]), baoCaoLuongRoutes);
app.use("/phan-tich-cong", requireAuth, requireRole(["admin", "manager"]), phanTichCongRoutes);
app.use("/tra-luong", requireAuth, requireRole(["admin", "manager"]), luongPayRoutes);

// Tài khoản (Admin + Manager kế toán)
app.use("/tai-khoan", requireAuth, requireRole(["admin", "manager", "employee"]), taiKhoanRoutes);

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
 * Xử lý lỗi & 404
 * ---------------------------------------------- */
app.use((_req, res) => res.status(404).json({ message: "Endpoint không tồn tại" }));

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(" SERVER ERROR:", err);
  res.status(err?.status || 500).json({ message: err?.message || "Lỗi máy chủ" });
});

/* ----------------------------------------------
 * Khởi động server
 * ---------------------------------------------- */
const PORT = Number(process.env.PORT || 8001);
app.listen(PORT, () => console.log(`HR server running at http://localhost:${PORT}`));

export default app;
