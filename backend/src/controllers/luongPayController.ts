// src/controllers/luongPayController.ts
import { Request, Response } from "express";
import * as service from "../services/luongPayService";

export const pay = async (req: Request, res: Response) => {
  try {
    const result = await service.pay(req);
    return res.json({
      ok: true,
      message: result.sentPdf ? "Đã trả lương và gửi email phiếu lương!" : "Đã trả lương!",
      result,
    });
  } catch (err: any) {
    console.error("LỖI PAY:", err);
    return res.status(500).json({ error: err.message || "Lỗi khi trả lương" });
  }
};

export const payAll = async (req: Request, res: Response) => {
  try {
    const result = await service.payAll(req);
    return res.json({
      ok: true,
      message: `Đã xử lý thanh toán cho ${result.count} nhân viên!`,
      result,
    });
  } catch (err: any) {
    console.error("LỖI PAY ALL:", err);
    return res.status(500).json({ error: err.message || "Lỗi khi trả lương hàng loạt" });
  }
};
