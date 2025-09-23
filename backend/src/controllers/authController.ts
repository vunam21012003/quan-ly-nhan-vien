import { Request, Response } from "express";
import * as authService from "../services/authService";

export const register = async (req: Request, res: Response) => {
  const result = await authService.register(req.body);
  if (result.error) {
    return res.status(result.status || 500).json({ error: result.error });
  }
  return res.status(201).json(result.data);
};

export const login = async (req: Request, res: Response) => {
  const result = await authService.login(req.body);
  if (result.error) {
    return res.status(result.status || 500).json({ error: result.error });
  }
  return res.json(result.data);
};

export const changePassword = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const result = await authService.changePassword(userId, req.body);
  if (result.error) {
    return res.status(result.status || 500).json({ error: result.error });
  }
  return res.json(result.data);
};

export const me = (req: Request, res: Response) => {
  res.json((req as any).user);
};
