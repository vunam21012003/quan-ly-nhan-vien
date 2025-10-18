import { Request, Response } from "express";
import * as service from "../services/ngayLeService";

export const list = async (_req: Request, res: Response) => {
  try {
    const data = await service.getAll();
    res.json({ items: data });
  } catch (err) {
    console.error("GET /ngay-le error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const result = await service.create(req);
    if (result.error) return res.status(result.status || 400).json({ error: result.error });
    res.status(201).json(result.data);
  } catch (err) {
    console.error("POST /ngay-le error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const result = await service.remove(req);
    if (result.error) return res.status(result.status || 400).json({ error: result.error });
    res.json(result.data);
  } catch (err) {
    console.error("DELETE /ngay-le/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
