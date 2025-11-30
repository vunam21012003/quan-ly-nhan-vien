//baoCaoLuongController.ts
import { Request, Response } from "express";
import * as service from "../services/baoCaoLuongService";
import path from "path";

export const getBaoCaoLuong = async (req: Request, res: Response) => {
  try {
    // ✅ Truyền toàn bộ req vào service, KHÔNG truyền req.query nữa
    const result = await service.getBaoCaoLuong(req);
    res.json(result);
  } catch (err) {
    console.error("[GET /bao-cao/luong] error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const exportExcel = async (req: Request, res: Response) => {
  try {
    // ✅ Truyền toàn bộ req thay vì req.query
    const filePath = await service.exportBaoCaoLuongExcel(req);
    res.download(filePath, path.basename(filePath), (err) => {
      if (err) console.error("Download error:", err);
    });
  } catch (err) {
    console.error("[GET /bao-cao/luong/export] error:", err);
    res.status(500).json({ error: "Không thể xuất file Excel" });
  }
};

// ✅ Lấy chi tiết lương của một nhân viên
export const getChiTietLuongNhanVien = async (req: Request, res: Response) => {
  try {
    const nhan_vien_id = Number(req.params.nhan_vien_id);

    // ✅ Dùng ép kiểu rõ ràng để TypeScript không cảnh báo
    const thang = Number((req.query.thang as string) || 0);
    const nam = Number((req.query.nam as string) || 0);

    const data = await service.getChiTietLuongNhanVien(nhan_vien_id, thang, nam);
    res.json(data);
  } catch (err) {
    console.error("[GET /bao-cao/luong/chi-tiet/:nhan_vien_id] error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// 📌 Lấy lịch sử trả lương đầy đủ theo từng lần trả
export const getLichSuTraLuong = async (req: Request, res: Response) => {
  try {
    const nhan_vien_id = Number(req.params.nhan_vien_id);
    const thang = Number(req.query.thang);
    const nam = Number(req.query.nam);

    const items = await service.getLichSuTraLuong(nhan_vien_id, thang, nam);

    return res.json({ items });
  } catch (err) {
    console.error("[GET /bao-cao/luong/lich-su] error:", err);
    return res.status(500).json({ error: "Lỗi server" });
  }
};
