// src/controllers/phuCapThangController.ts
import { Request, Response } from "express";
import * as service from "../services/phuCapThangService";

export const list = async (req: Request, res: Response) => {
  const result = await service.list(req.query);
  res.json({ data: result.data });
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

export const autoCopy = async (req: Request, res: Response) => {
  const { thang, nam } = req.body;
  const result = await service.autoCopyFromLastMonth(thang, nam);
  res.json(result);
};
