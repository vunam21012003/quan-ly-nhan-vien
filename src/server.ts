// src/server.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";

// Routers (chú ý đúng chính tả tên file)
import phongBanRoutes from "./routes/phongBanRoutes";
import chucvuRoutes from "./routes/chucvuRoutes";
import nhanVienRoutes from "./routes/user"; // file user.ts chính là nhân viên
import chamCongRoutes from "./routes/chamCongRoutes";
import hopDongRoutes from "./routes/hopDongRoutes";
import luongRoutes from "./routes/luongRoutes";
import lichSuTraLuongRoutes from "./routes/lichSuTraLuongRoutes";
import phanTichCongRoutes from "./routes/phanTichCongRoutes";
import taiKhoanRoutes from "./routes/taiKhoanRoutes";
import baoCaoLuongRoutes from "./routes/baoCaoLuongRoutes";

// import { authMiddleware } from './plugins/auth';         // nếu muốn bảo vệ route

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

// Mount business routes
app.use("/phong-ban", phongBanRoutes);
app.use("/chuc-vu", chucvuRoutes);
app.use("/nhan-vien", nhanVienRoutes);
app.use("/cham-cong", chamCongRoutes);
app.use("/hop-dong", hopDongRoutes);
app.use("/luong", luongRoutes);
app.use("/lich-su-tra-luong", lichSuTraLuongRoutes);
app.use("/phan-tich-cong", phanTichCongRoutes);
app.use("/tai-khoan", taiKhoanRoutes);
app.use("/bao-cao-luong", baoCaoLuongRoutes);

// 404
app.use((_req, res) =>
  res.status(404).json({ message: "Endpoint không tồn tại" })
);

// Error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  res
    .status(err?.status || 500)
    .json({ message: err?.message || "Lỗi máy chủ" });
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () =>
  console.log(`HR server listening on http://localhost:${PORT}`)
);

export default app;
