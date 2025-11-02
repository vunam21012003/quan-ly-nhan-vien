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

// ===== DANH SÁCH LƯƠNG CỦA CHÍNH NHÂN VIÊN =====
export const getMine = async (req: Request, res: Response) => {
  try {
    const result = await service.getMine(req as any);
    res.json(result);
  } catch (err) {
    console.error("[GET /luong/me] error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ===== LẤY CHI TIẾT THEO ID =====
export const getById = async (req: Request, res: Response) => {
  try {
    const result = await service.getById(req);
    if (!result) return res.status(404).json({ message: "Không tìm thấy" });
    res.json(result);
  } catch (err) {
    console.error("[GET /luong/:id] error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ===== TẠO BẢN LƯƠNG =====
export const create = async (req: Request, res: Response) => {
  try {
    const result = await service.create(req.body);
    if ((result as any).error) return res.status(400).json({ error: (result as any).error });
    res.status(201).json({ id: (result as any).id });
  } catch (err) {
    console.error("[POST /luong] error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ===== CẬP NHẬT BẢN LƯƠNG =====
export const update = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const result = await service.update(id, req.body);
    if ((result as any).error) return res.status(400).json({ error: (result as any).error });
    res.json({ ok: true });
  } catch (err) {
    console.error("[PUT /luong/:id] error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ===== XOÁ BẢN LƯƠNG =====
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

// ===== TÍNH LƯƠNG THEO THÁNG =====
export const calcSalary = async (req: Request, res: Response) => {
  try {
    const { thang, nam } = req.query;
    if (!thang || !nam) return res.status(400).json({ error: "Thiếu tham số thang hoặc nam" });

    const result = await service.calcSalaryForMonth(Number(thang), Number(nam));
    res.json(result);
  } catch (err) {
    console.error("[POST /luong/tinh-thang] error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
