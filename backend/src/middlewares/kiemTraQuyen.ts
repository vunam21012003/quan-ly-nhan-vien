import { Request, Response, NextFunction } from "express";

// Middleware kiểm tra vai trò người dùng (role)
export const kiemTraQuyen = (...danhSachVaiTroChoPhep: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const vaiTro = req.user?.role;

    if (!vaiTro || !danhSachVaiTroChoPhep.includes(vaiTro)) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập." });
    }

    next();
  };
};
