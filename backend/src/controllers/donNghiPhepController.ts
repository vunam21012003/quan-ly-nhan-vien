import { Request, Response } from "express";
import * as service from "../services/donNghiPhepService";

// Helper: Lấy ID nhân viên từ token đã giải mã (req.phamvi)
const getEmployeeIdFromUser = (req: Request): number | undefined => {
  return req.phamvi?.employeeId ?? undefined;
};

/**
 * Tạo đơn xin nghỉ mới
 */
export const create = async (req: Request, res: Response) => {
  try {
    const nhan_vien_id = getEmployeeIdFromUser(req);
    if (!nhan_vien_id) {
      return res
        .status(400)
        .json({ message: "Không tìm thấy hồ sơ nhân viên liên kết với tài khoản này." });
    }

    const result = await service.createDonNghi({
      ...req.body,
      nhan_vien_id,
    });

    res.status(201).json({ message: "Gửi đơn thành công", data: result });
  } catch (error: any) {
    console.error("[DonNghiPhep] Create Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Lấy danh sách đơn nghỉ (Có lọc theo quyền và params)
 */
export const getAll = async (req: Request, res: Response) => {
  try {
    if (!req.phamvi) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { role, managedDepartmentIds, employeeId } = req.phamvi;
    const safeUserId = employeeId ?? 0;

    const filters: { trang_thai?: string; year?: number } = {};

    if (typeof req.query.trang_thai === "string") {
      filters.trang_thai = req.query.trang_thai;
    }

    if (req.query.year) {
      filters.year = Number(req.query.year);
    }

    const list = await service.getListDonNghi(safeUserId, role, managedDepartmentIds, filters);

    res.json(list);
  } catch (error: any) {
    console.error("[DonNghiPhep] GetAll Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Duyệt đơn (Admin/Manager)
 */
export const approve = async (req: Request, res: Response) => {
  try {
    const donId = Number(req.params.id);
    const managerId = getEmployeeIdFromUser(req);

    if (!managerId) {
      return res
        .status(400)
        .json({ message: "Lỗi xác thực người duyệt (Không tìm thấy ID nhân viên)." });
    }

    await service.approveDonNghi(donId, managerId);
    res.json({ message: "Đã duyệt đơn và cập nhật chấm công thành công." });
  } catch (error: any) {
    console.error("[DonNghiPhep] Approve Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Từ chối đơn (Admin/Manager)
 */
export const reject = async (req: Request, res: Response) => {
  try {
    const donId = Number(req.params.id);
    const managerId = getEmployeeIdFromUser(req);
    const { ly_do_tu_choi } = req.body;

    if (!managerId) {
      return res.status(400).json({ message: "Lỗi xác thực người duyệt." });
    }

    await service.rejectDonNghi(donId, managerId, ly_do_tu_choi || "Không có lý do");
    res.json({ message: "Đã từ chối đơn nghỉ." });
  } catch (error: any) {
    console.error("[DonNghiPhep] Reject Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Hủy đơn (Nhân viên tự hủy khi chưa duyệt)
 */
export const cancel = async (req: Request, res: Response) => {
  try {
    const donId = Number(req.params.id);
    const nhanVienId = getEmployeeIdFromUser(req);

    if (!nhanVienId) {
      return res.status(400).json({ message: "Lỗi xác thực nhân viên." });
    }

    const success = await service.cancelDonNghi(donId, nhanVienId);

    if (!success) {
      return res
        .status(400)
        .json({ message: "Không thể hủy đơn này (Đơn đã được duyệt/từ chối hoặc không tồn tại)." });
    }

    res.json({ message: "Đã hủy đơn thành công." });
  } catch (error: any) {
    console.error("[DonNghiPhep] Cancel Error:", error);
    res.status(500).json({ message: error.message });
  }
};
