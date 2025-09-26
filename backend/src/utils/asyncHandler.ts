import { Request, Response, NextFunction } from "express";

type Fn = (req: Request, res: Response, next: NextFunction) => any | Promise<any>;

export const asyncHandler = (fn: Fn) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res, next)).catch(next);
