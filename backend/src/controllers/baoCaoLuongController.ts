import { Request, Response } from "express";
import * as service from "../services/baoCaoLuongService";

export const getBaoCaoLuong = async (req: Request, res: Response) => {
  try {
    const result = await service.getBaoCaoLuong(req.query);
    res.json(result);
  } catch (err: any) {
    console.error("[GET /bao-cao-luong/luong] error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const getChiTietLuongNhanVien = async (req: Request, res: Response) => {
  try {
    const nhan_vien_id = Number(req.params.nhan_vien_id);
    const { thang, nam } = req.query;
    if (!Number.isInteger(nhan_vien_id) || nhan_vien_id <= 0) {
      return res.status(400).json({ error: "nhan_vien_id không hợp lệ" });
    }

    const result = await service.getChiTietLuongNhanVien(nhan_vien_id, { thang, nam });
    res.json(result);
  } catch (err: any) {
    console.error("[GET /bao-cao-luong/luong/chi-tiet/:nhan_vien_id] error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
