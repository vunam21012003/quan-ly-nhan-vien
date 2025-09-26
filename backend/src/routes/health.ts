import { Router } from "express";
import { pool } from "../db";

const router = Router();

/**
 * GET /health
 * - status: "ok"
 * - time: ISO timestamp
 * - uptime_seconds: thời gian tiến trình chạy
 * - db.ok: true/false; nếu false có thêm error
 */
router.get("/", async (_req, res) => {
  const now = new Date().toISOString();
  const uptime = Math.floor(process.uptime());

  let db = { ok: true as boolean, error: undefined as string | undefined };

  try {
    // Ping MySQL
    const [rows] = await pool.query("SELECT 1 AS ok");
    // @ts-ignore
    if (!rows || (Array.isArray(rows) && !rows.length)) {
      db.ok = false;
      db.error = "Empty result";
    }
  } catch (e: any) {
    db.ok = false;
    db.error = e?.message || "DB error";
  }

  res.status(db.ok ? 200 : 503).json({
    status: "ok",
    time: now,
    uptime_seconds: uptime,
    db,
  });
});

// Tuỳ chọn: HEAD /health trả về nhanh cho load balancer
router.head("/", (_req, res) => res.sendStatus(204));

export default router;
