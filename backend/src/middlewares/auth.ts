// src/middlewares/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

/**
 * Hình dạng payload lưu trong JWT
 */
export interface JwtUser extends JwtPayload {
  id: number;
  role: "admin" | "manager" | "employee";
  username: string;
}

/**
 * (Tuỳ chọn) Augment kiểu cho Express.Request để có req.user gọn gàng.
 * Không bắt buộc, nhưng giúp code ở routes type-safe hơn.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // Dùng optional để tránh bắt buộc gán ở mọi nơi
    // requireAuth sẽ gán req.user > đảm bảo tồn tại trước khi tới handler
    interface Request {
      user?: JwtUser;
    }
  }
}
export {}; // đảm bảo file là module để augmentation có hiệu lực

/**
 * Helper: lấy token "Bearer <token>" từ header Authorization
 */
function getBearerToken(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h) return null;
  const [scheme, token] = h.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

/**
 * Middleware: yêu cầu đăng nhập (có JWT hợp lệ)
 * - Giải mã token bằng JWT_SECRET
 * - Gắn payload vào req.user
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as JwtUser;
    req.user = payload; // type-safe nhờ augmentation ở trên
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/**
 * Middleware: kiểm tra vai trò được phép
 * Ví dụ dùng: requireRole(["admin"]) hoặc requireRole(["admin","manager"])
 */
export function requireRole(roles: Array<JwtUser["role"]>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!roles.includes(user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

/**
 * (Tuỳ chọn) Helper nhanh để kiểm tra role trong handler
 */
export const isAdmin = (req: Request) => req.user?.role === "admin";
export const isManager = (req: Request) => req.user?.role === "manager";
export const isEmployee = (req: Request) => req.user?.role === "employee";
