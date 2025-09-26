// src/server.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import path from "path";

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
import healthRoutes from "./routes/health";

import { requireAuth, requireRole } from "./middlewares/auth";
import { pool } from "./db";

const app = express();

// Middlewares
app.use(helmet());
app.use(cors({ origin: true }));
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));
app.use("/health", healthRoutes);

// 👉 Serve static HTML/CSS/JS from frontend/public
const publicDir = path.join(__dirname, "..", "..", "frontend", "public");
app.use(express.static(publicDir));

// 👉 Trang mặc định khi vào /
app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// Health check
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

// Debug: xem đang dùng schema nào
app.get("/__debug/db", async (_req, res) => {
  try {
    const [rows]: any = await pool.query("SELECT DATABASE() AS dbname");
    res.json({ dbname: rows?.[0]?.dbname });
  } catch (e: any) {
    res.status(500).json({ error: e?.message });
  }
});

// Auth
app.use("/auth", authRoutes);

// Public routes
app.use("/phong-ban", phongBanRoutes);
app.use("/chuc-vu", chucvuRoutes);
app.use("/nhan-vien", nhanVienRoutes);

// Protected routes
app.use("/cham-cong", requireAuth, chamCongRoutes);
app.use("/hop-dong", requireAuth, hopDongRoutes);
app.use("/luong", requireAuth, luongRoutes);
app.use("/lich-su-tra-luong", requireAuth, requireRole(["admin", "manager"]), lichSuTraLuongRoutes);
app.use("/bao-cao-luong", requireAuth, requireRole(["admin", "manager"]), baoCaoLuongRoutes);
app.use("/phan-tich-cong", requireAuth, requireRole(["admin", "manager"]), phanTichCongRoutes);
app.use("/tai-khoan", requireAuth, requireRole(["admin"]), taiKhoanRoutes);

// 404 fallback
app.use((_req, res) => res.status(404).json({ message: "Endpoint không tồn tại" }));

// Error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  res.status(err?.status || 500).json({ message: err?.message || "Lỗi máy chủ" });
});

// Start server
const PORT = Number(process.env.PORT || 8001);
app.listen(PORT, () => console.log(`HR server listening on http://localhost:${PORT}`));

export default app;
