import { Request, Response } from "express";
import * as phanCongLamBuService from "../services/phanCongLamBuService";

export const getByDate = async (req: Request, res: Response) => {
  try {
    const data = await phanCongLamBuService.getByDate(req.params.ngay!);
    res.json({ status: true, data });
  } catch (err: any) {
    res.status(500).json({ status: false, message: err.message });
  }
};

export const getNhanVienChoPhanCongController = async (req: Request, res: Response) => {
  try {
    const phamvi = req.phamvi!;
    let phongBanId: number | null = null;

    if (phamvi.role !== "admin") {
      if (phamvi.managedDepartmentIds && phamvi.managedDepartmentIds.length > 0) {
        // 💡 SỬA ĐỔI: Ép kiểu giá trị để TypeScript chấp nhận
        phongBanId = phamvi.managedDepartmentIds[0] as number;
      } else {
        return res.json({ status: true, items: [] });
      }
    }

    const data = await phanCongLamBuService.getNhanVienChoPhanCong(phongBanId);

    res.json({ status: true, items: data.items });
  } catch (err: any) {
    res.status(500).json({ status: false, message: err.message });
  }
};

export const saveForDate = async (req: Request, res: Response) => {
  try {
    const { ngay, nhan_vien_ids } = req.body || {};
    if (!ngay) return res.status(400).json({ status: false, message: "Thiếu ngày" });

    const result = await phanCongLamBuService.saveForDate(ngay, nhan_vien_ids || []);
    res.json({ status: true, ...result });
  } catch (err: any) {
    res.status(500).json({ status: false, message: err.message });
  }
};
