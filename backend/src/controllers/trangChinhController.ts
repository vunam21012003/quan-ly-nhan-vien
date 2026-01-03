// src/controllers/trangChinhController.ts
import { Request, Response } from "express";
import { getCompleteDashboard } from "../services/trangChinhService";

export async function getComplete(req: Request, res: Response) {
  try {
    const accountId = (req as any).user?.id as number | undefined;
    const phamvi = (req as any).phamvi;

    if (!accountId) return res.status(401).json({ message: "Unauthorized" });
    if (!phamvi) return res.status(403).json({ message: "Forbidden" });

    const data = await getCompleteDashboard({ accountId, phamvi });
    return res.json(data);
  } catch (err: any) {
    console.error("getComplete error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
