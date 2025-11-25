import { Request, Response } from "express";
import * as service from "../services/phuCapLoaiService";

export const list = async (_req: Request, res: Response) => {
  const data = await service.list();
  res.json(data);
};

export const create = async (req: Request, res: Response) => {
  const result = await service.create(req.body);
  res.json(result);
};

export const update = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const result = await service.update(id, req.body);
  res.json(result);
};

export const remove = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const result = await service.remove(id);
  res.json(result);
};
