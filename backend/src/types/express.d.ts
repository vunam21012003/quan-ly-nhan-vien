//express.d.ts
import type { JwtUser } from "../middlewares/auth";

declare global {
  namespace Express {
    interface Request {
      user?: JwtUser;
      file?: Multer.File;
      files?: Multer.File[];
    }
  }
}

export {};
