import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

// Tạo thư mục uploads nếu chưa có
const uploadPath = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// Cấu hình multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now() + "-" + Math.random().toString(36).substring(2) + ext;
    cb(null, name);
  },
});

const upload = multer({ storage });

// API upload
router.post("/", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Không có file" });

  const url = `/uploads/${req.file.filename}`;

  res.json({ url: url });
});

export default router;
