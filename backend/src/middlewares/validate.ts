import { ZodTypeAny } from "zod";
import { Request, Response, NextFunction } from "express";

export const validate =
  (schema: ZodTypeAny) => (req: Request, res: Response, next: NextFunction) => {
    const data = { body: req.body, params: req.params, query: req.query };
    const result = schema.safeParse(data);

    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        issues: result.error.issues.map((i: any) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }

    next();
  };
