// src/server.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";

import phongBanRoutes from "./routes/phongBanRoutes";
import chucvuRoutes from "./routes/chucvuRoutes";
import nhanVienRoutes from "./routes/nhanVienRoutes"; // file user.ts chính là nhân viên
import chamCongRoutes from "./routes/chamCongRoutes";
import hopDongRoutes from "./routes/hopDongRoutes";
import luongRoutes from "./routes/luongRoutes";
import lichSuTraLuongRoutes from "./routes/lichSuTraLuongRoutes";
import phanTichCongRoutes from "./routes/phanTichCongRoutes";
import taiKhoanRoutes from "./routes/taiKhoanRoutes";
import baoCaoLuongRoutes from "./routes/baoCaoLuongRoutes";
import authRoutes from "./routes/auth";

import { requireAuth, requireRole } from "./middlewares/auth";
import { pool } from "./db";

const app = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

// Auth endpoints
app.use("/auth", authRoutes);

// Public routes
app.use("/phong-ban", phongBanRoutes);
app.use("/chuc-vu", chucvuRoutes);
app.use("/nhan-vien", nhanVienRoutes);

// Protected routes
app.use("/cham-cong", requireAuth, chamCongRoutes);
app.use("/hop-dong", requireAuth, hopDongRoutes);
app.use("/luong", requireAuth, requireRole(["admin", "manager"]), luongRoutes);
app.use("/lich-su-tra-luong", requireAuth, requireRole(["admin", "manager"]), lichSuTraLuongRoutes);
app.use("/bao-cao-luong", requireAuth, requireRole(["admin", "manager"]), baoCaoLuongRoutes);
app.use("/phan-tich-cong", requireAuth, requireRole(["admin", "manager"]), phanTichCongRoutes);
app.use("/tai-khoan", requireAuth, requireRole(["admin"]), taiKhoanRoutes);

// Health check DB
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

// 404
app.use((_req, res) => res.status(404).json({ message: "Endpoint không tồn tại" }));

// Error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  res.status(err?.status || 500).json({ message: err?.message || "Lỗi máy chủ" });
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => console.log(`HR server listening on http://localhost:${PORT}`));

export default app;
