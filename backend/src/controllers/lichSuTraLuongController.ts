//lichSuTraLuongController.ts
import { Request, Response } from "express";
import * as service from "../services/lichSuTraLuongService";

export const list = async (req: Request, res: Response) => {
  try {
    const result = await service.getList(req.query);
    res.json(result);
  } catch (err: any) {
    console.error("[GET /lich-su-tra-luong] error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const result = await service.create(req.body);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    res.status(201).json({ id: result.id });
  } catch (err: any) {
    console.error("[POST /lich-su-tra-luong] error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const result = await service.update(id, req.body);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[PUT /lich-su-tra-luong/:id] error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const result = await service.remove(id);
    if (!result) return res.status(400).json({ error: "id không hợp lệ" });
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[DELETE /lich-su-tra-luong/:id] error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
