import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

/**
 * Định nghĩa payload trong JWT
 */
export interface JwtUser extends JwtPayload {
  id: number;
  role: "admin" | "manager" | "employee";
  username: string;
}

// Augment Express để hỗ trợ req.user
declare global {
  namespace Express {
    interface Request {
      user?: JwtUser;
    }
  }
}
export {}; // bắt buộc để kích hoạt augmentation

/**
 * Trích token từ header Authorization
 */
function getBearerToken(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h) return null;
  const [scheme, token] = h.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

/**
 * Middleware: xác thực bằng JWT
 * - Nếu hợp lệ: gắn req.user
 * - Nếu sai: trả 401
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev_secret") as JwtUser;
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/**
 * Middleware: kiểm tra vai trò được cho phép
 * Ví dụ: requireRole(["admin", "manager"])
 */
export function requireRole(roles: Array<JwtUser["role"]>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (!roles.includes(user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

/**
 * Helper kiểm tra vai trò
 */
export const isAdmin = (req: Request) => req.user?.role === "admin";
export const isManager = (req: Request) => req.user?.role === "manager";
export const isEmployee = (req: Request) => req.user?.role === "employee";
