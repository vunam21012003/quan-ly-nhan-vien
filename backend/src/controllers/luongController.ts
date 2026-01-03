// src/controllers/luongController.ts
import { Request, Response } from "express";
import * as service from "../services/luongService";

// ===== DANH SÁCH LƯƠNG =====
export const getAll = async (req: Request, res: Response) => {
  try {
    const result = await service.getAll(req);
    res.json(result);
  } catch (err) {
    console.error("[GET /luong] error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ===== LƯƠNG CỦA NGƯỜI ĐĂNG NHẬP =====
export const getMine = async (req: Request, res: Response) => {
  try {
    const result = await service.getMine(req as any);
    res.json(result);
  } catch (err) {
    console.error("[GET /luong/me] error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ===== LẤY CHI TIẾT =====
export const getById = async (req: Request, res: Response) => {
  try {
    const row = await service.getById(req);
    if (!row) return res.status(404).json({ message: "Không tìm thấy" });

    row.luong_p1 = row.luong_thoa_thuan ?? 0;
    row.luong_p2 = row.luong_p2 ?? 0;
    row.luong_p3 = row.luong_p3 ?? 0;

    res.json(row);
  } catch (err) {
    console.error("[GET /luong/:id] error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// // ===== TẠO =====
// export const create = async (req: Request, res: Response) => {
//   try {
//     const result = await service.create(req.body);
//     if (result.error) return res.status(400).json(result);
//     res.status(201).json(result);
//   } catch (err) {
//     console.error("[POST /luong] error:", err);
//     res.status(500).json({ error: "Server error" });
//   }
// };

// // ===== CẬP NHẬT =====
// export const update = async (req: Request, res: Response) => {
//   try {
//     const id = Number(req.params.id);
//     const result = await service.update(id, req.body);
//     if (result.error) return res.status(400).json(result);
//     res.json({ ok: true });
//   } catch (err) {
//     console.error("[PUT /luong/:id] error:", err);
//     res.status(500).json({ error: "Server error" });
//   }
// };

// ===== XOÁ =====
export const remove = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const ok = await service.remove(id);
    if (!ok) return res.status(400).json({ error: "id không hợp lệ" });
    res.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /luong/:id] error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ===== TÍNH LƯƠNG =====
export const calcSalary = async (req: Request, res: Response) => {
  try {
    const { thang, nam, phong_ban_id, nhan_vien_id } = req.query;

    if (!thang || !nam) return res.status(400).json({ error: "Thiếu tham số thang hoặc nam" });

    const result = await service.calcSalaryForMonth({
      thang: Number(thang),
      nam: Number(nam),
      phongBanId: phong_ban_id ? Number(phong_ban_id) : null,
      nhanVienId: nhan_vien_id ? Number(nhan_vien_id) : null,
    });

    res.json(result);
  } catch (err) {
    console.error("[POST /luong/tinh-thang] error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ===== DUYỆT LƯƠNG/ HỦY DUYỆT =====
export const toggleDuyet = async (req: Request, res: Response) => {
  try {
    const result = await service.toggleDuyetLuong(req);

    if (result.error) return res.status(400).json(result);

    res.json(result);
  } catch (err) {
    console.error("[POST /luong/toggle-duyet] error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
