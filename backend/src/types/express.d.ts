import type { JwtUser } from "../middlewares/auth";

declare global {
  namespace Express {
    interface Request {
      user?: JwtUser;
    }
  }
}

export {};
