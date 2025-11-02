// src/middlewares/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { layPhamViNguoiDung } from "../utils/pham-vi-nguoi-dung";

export interface JwtUser extends JwtPayload {
  id: number;
  username: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtUser;
      phamvi?: {
        employeeId: number | null;
        managedDepartmentIds: number[];
        role: "admin" | "manager" | "employee";
      };
    }
  }
}

export {}; // Bắt buộc để kích hoạt augmentation

function getBearerToken(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h) return null;
  const [scheme, token] = h.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

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

export function requireRole(roles: Array<"admin" | "manager" | "employee">) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const phamvi = await layPhamViNguoiDung(req);

    if (!roles.includes(phamvi.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    (req as any).phamvi = phamvi;
    next();
  };
}

export const isAdmin = (req: Request) => req.phamvi?.role === "admin";
export const isManager = (req: Request) => req.phamvi?.role === "manager";
export const isEmployee = (req: Request) => req.phamvi?.role === "employee";
