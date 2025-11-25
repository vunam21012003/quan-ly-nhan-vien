//phanCongLamBuController
import { Request, Response } from "express";
import * as phanCongLamBuService from "../services/phanCongLamBuService";
import { pool } from "../db";

export const getByDate = async (req: Request, res: Response) => {
  try {
    const data = await phanCongLamBuService.getByDate(req.params.ngay!);
    res.json({ status: true, data });
  } catch (err: any) {
    res.status(500).json({ status: false, message: err.message });
  }
};

/* =====================================================
   1. LẤY DANH SÁCH NHÂN VIÊN CHO PHÂN CÔNG LÀM BÙ
===================================================== */
export const getNhanVienChoPhanCongController = async (req: Request, res: Response) => {
  try {
    const phamvi = req.phamvi!;
    let phongBanId: number | null = null;

    /* ======================================================
        A. ADMIN → thấy toàn bộ nhân viên
    ====================================================== */
    if (phamvi.role === "admin") {
      const data = await phanCongLamBuService.getNhanVienChoPhanCong(null);
      return res.json({ status: true, items: data.items });
    }

    /* ======================================================
        B. MANAGER → phân biệt kế toán và manager thường
    ====================================================== */
    if (phamvi.role === "manager") {
      // Lấy phòng ban mà manager đang quản lý
      const managedPB = phamvi.managedDepartmentIds?.[0] ?? null;
      if (!managedPB) return res.json({ status: true, items: [] });

      // 🔥 TRUY DB ĐỂ XEM TÊN PHÒNG BAN CỦA MANAGER
      const [[pbRow]]: any = await pool.query(
        `SELECT ten_phong_ban FROM phong_ban WHERE id = ? LIMIT 1`,
        [managedPB]
      );

      const pbName = (pbRow?.ten_phong_ban || "").toLowerCase();

      const isManagerKT = pbName.includes("kế toán") || pbName.includes("ke toan");

      // Manager kế toán → xem toàn bộ nhân viên
      if (isManagerKT) {
        const data = await phanCongLamBuService.getNhanVienChoPhanCong(null);
        return res.json({ status: true, items: data.items });
      }

      // Manager thường → chỉ xem nhân viên phòng ban mình
      const data = await phanCongLamBuService.getNhanVienChoPhanCong(managedPB);
      return res.json({ status: true, items: data.items });
    }

    // Employee → không có quyền phân công
    return res.json({ status: true, items: [] });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

export const saveForDate = async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      ngay?: string;
      nhan_vien_ids?: any[];
    };

    const ngay = body.ngay;
    const nhanVienIdsRaw = Array.isArray(body.nhan_vien_ids) ? body.nhan_vien_ids : [];
    const listIds = nhanVienIdsRaw.map((id) => Number(id));

    if (!ngay) {
      return res.status(400).json({
        status: false,
        message: "Thiếu ngày",
      });
    }

    // 🔥 LẤY PHÒNG BAN QUẢN LÝ (nếu manager)
    const phongBanId =
      req.phamvi?.role === "admin" ? null : (req.phamvi?.managedDepartmentIds?.[0] ?? null);

    const result: Record<string, any> = await phanCongLamBuService.saveForDate(
      ngay,
      listIds,
      phongBanId
    );

    return res.json({
      status: true,
      ...result,
    });
  } catch (err: any) {
    return res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};
