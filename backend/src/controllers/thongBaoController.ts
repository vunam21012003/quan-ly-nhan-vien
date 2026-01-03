// src/controllers/thongBaoController.ts
import { Request, Response } from "express";
import * as thongBaoService from "../services/thongBaoService";

export const layTheoNguoi = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const data = await thongBaoService.layTheoNguoi(id);
  res.json(data);
};

export const tao = async (req: Request, res: Response) => {
  const result = await thongBaoService.tao(req.body);
  res.json(result);
};

export const danhDauDaDoc = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const result = await thongBaoService.danhDauDaDoc(id);
  res.json(result);
};

export const xoa = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const result = await thongBaoService.xoa(id);
  res.json(result);
};

export const markAsRead = async (req: any, res: any) => {
  try {
    const id = req.params.id;
    await thongBaoService.danhDauDaDoc(id);
    res.json({ ok: true, message: "Đã đánh dấu đã xem" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Lỗi server" });
  }
};
