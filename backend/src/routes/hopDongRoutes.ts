import { Router } from "express";
import multer, { StorageEngine } from "multer";
import * as controller from "../controllers/hopDongController";

const router = Router();

// ⚙️ Cấu hình multer: lưu file trong thư mục ./uploads
const storage: StorageEngine = multer.diskStorage({
  destination: (
    req: Express.Request,
    file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void
  ) => {
    cb(null, "uploads/"); // nhớ tạo thư mục "uploads" ở gốc dự án backend
  },
  filename: (
    req: Express.Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void
  ) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + "-" + file.originalname);
  },
});

const upload = multer({ storage });

/**
 * 🚀 Các route CRUD cho hợp đồng
 * server.ts mount: app.use("/hop-dong", requireAuth, hopDongRoutes)
 * => Endpoint đầy đủ:
 *    GET    /hop-dong
 *    GET    /hop-dong/:id
 *    POST   /hop-dong
 *    PUT    /hop-dong/:id
 *    DELETE /hop-dong/:id
 */

// Danh sách hợp đồng
router.get("/", controller.list);

// Chi tiết hợp đồng
router.get("/:id", controller.detail);

// Thêm hợp đồng (có file upload)
router.post("/", upload.single("file_hop_dong"), controller.create);

// Sửa hợp đồng (có file upload)
router.put("/:id", upload.single("file_hop_dong"), controller.update);

// Xoá hợp đồng
router.delete("/:id", controller.remove);

export default router;
