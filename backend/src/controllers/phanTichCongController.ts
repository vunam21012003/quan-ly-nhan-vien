import { Request, Response } from "express";
import * as service from "../services/phanTichCongService";

export const getAll = async (req: Request, res: Response) => {
  try {
    const rows = await service.getAll(req);
    res.json(rows);
  } catch (e) {
    console.error("[phanTichCongController.getAll]", e);
    res.status(500).json({ error: "Server error" });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const result = await service.create(req);
    if (result.error) {
      return res.status(result.status || 400).json({ message: result.error });
    }
    res.status(201).json({ id: result.id, message: "OK" });
  } catch (e) {
    console.error("[phanTichCongController.create]", e);
    res.status(500).json({ error: "Server error" });
  }
};
