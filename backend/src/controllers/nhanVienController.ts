import { Request, Response } from "express";
import * as service from "../services/nhanVienService";

export const getAll = async (req: Request, res: Response) => {
  try {
    const result = await service.getAll(req);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const result = await service.getById(req);
    if (!result) return res.status(404).json({ message: "Không tìm thấy" });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const result = await service.create(req.body);
    if (result.error) return res.status(400).json({ message: result.error });
    res.status(201).json({ id: result.id, message: "OK" });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const result = await service.update(id, req.body);
    if (result.error) return res.status(400).json({ message: result.error });
    res.json({ message: "Đã cập nhật" });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
};

export const partialUpdate = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const result = await service.partialUpdate(id, req.body);
    if (result.error) return res.status(400).json({ message: result.error });
    res.json({ message: "Đã cập nhật", changed: result.changed });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const force = String(req.query.force || "") === "true";
    const result = await service.remove(id, force);
    if (result.error) return res.status(result.status || 400).json({ message: result.error });
    res.json({ message: result.message });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
};
