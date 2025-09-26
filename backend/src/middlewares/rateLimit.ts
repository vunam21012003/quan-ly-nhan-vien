import rateLimit from "express-rate-limit";

// Giới hạn 20 lần/10 phút cho đăng nhập
export const loginRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Quá nhiều lần đăng nhập. Vui lòng thử lại sau ít phút." },
});
