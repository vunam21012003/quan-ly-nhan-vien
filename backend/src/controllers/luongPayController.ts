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
