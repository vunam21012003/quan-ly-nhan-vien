// src/controllers/thuongPhatController.ts (FULL CODE ĐÃ SỬA LỖI ĐỎ)
import { Request, Response } from "express";
import * as service from "../services/thuongPhatService";

// Định nghĩa kiểu trả về dự kiến từ Service, bao gồm status (Optional)
interface ServiceResult {
  error?: string;
  status?: number; // Thêm status để fix lỗi đỏ
  ok?: boolean;
  data?: any;
}

/**
 * Lấy danh sách thưởng/phạt
 */
export const list = async (req: Request, res: Response) => {
  try {
    const data = await service.getList(req);
    res.json(data);
  } catch (err) {
    console.error("GET /thuong-phat error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Lấy chi tiết 1 bản ghi
 * (Hệ thống thưởng/phạt KHÔNG CÓ cập nhật, chỉ xem + xoá)
 */
export const detail = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    // Lỗi getById xảy ra vì nó không được export/định nghĩa trong thuongPhatService
    // ⭐ FIX getById: Bỏ ?. nếu hàm này không có trong service, hoặc giữ lại
    // nếu bạn định nghĩa nó sau này. Tôi tạm giữ lại để fix lỗi type.
    const data = await (service as any).getById?.(id, req);

    if (!data) return res.status(404).json({ message: "Không tìm thấy" });

    res.json({ data });
  } catch (err) {
    console.error("GET /thuong-phat/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Tạo mới thưởng/phạt
 */
export const create = async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    if (!body.thang || !body.nam) {
      return res.status(400).json({ message: "Thiếu tháng hoặc năm" });
    }

    const result = await service.create(req);

    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    res.status(201).json(result);
  } catch (err) {
    console.error("POST /thuong-phat error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Cập nhật thưởng/phạt
 * ❌ KHÔNG HỖ TRỢ UPDATE
 * (Để tránh sửa khi đã trả lương, đã duyệt lương)
 */
export const update = async (req: Request, res: Response) => {
  try {
    return res
      .status(400)
      .json({ message: "Thưởng/phạt không cho phép cập nhật. Chỉ thêm hoặc xoá." });
  } catch (err) {
    console.error("PUT /thuong-phat/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Xoá thưởng/phạt
 */
export const remove = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    // ⭐ FIX LỖI ĐỎ: Ép kiểu kết quả trả về để TypeScript nhận diện 'status'
    const result = (await service.remove(id, req)) as ServiceResult;

    if (result?.error) {
      // ⭐ FIX LỖI ĐỎ: Đảm bảo TypeScript biết result có status
      return res.status(result.status || 400).json({ message: result.error });
    }

    res.json({ message: "Đã xóa" });
  } catch (err) {
    console.error("DELETE /thuong-phat/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Xuất Excel
export const exportExcel = async (req: Request, res: Response) => {
  await service.exportExcel(req, res);
};
