import { Request, Response } from "express";
import * as service from "../services/luongService";

export const getAll = async (req: Request, res: Response) => {
  try {
    const result = await service.getAll(req);
    res.json(result);
  } catch (err) {
    console.error("[GET /luong] error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const getMine = async (req: Request, res: Response) => {
  try {
    const result = await service.getMine(req);
    res.json(result);
  } catch (err) {
    console.error("[GET /luong/me] error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const result = await service.getById(req);
    if (!result) return res.status(404).json({ message: "Không tìm thấy" });
    res.json(result);
  } catch (err) {
    console.error("[GET /luong/:id] error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const result = await service.create(req.body);
    if (result.error) return res.status(400).json({ error: result.error });
    res.status(201).json({ id: result.id });
  } catch (err) {
    console.error("[POST /luong] error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const result = await service.update(id, req.body);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  } catch (err) {
    console.error("[PUT /luong/:id] error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const ok = await service.remove(id);
    if (!ok) return res.status(400).json({ error: "id không hợp lệ" });
    res.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /luong/:id] error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
