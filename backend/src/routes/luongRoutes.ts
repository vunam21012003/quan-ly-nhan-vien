// src/routes/luongRoutes.ts
import { Router, Request, Response } from "express";
import { pool } from "../db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

type ParamsWithId = { id: string };

/** ==============================
 * Helper: build WHERE chung cho /luong
 * (Dùng cho GET /luong — KHÔNG dùng cho /luong/me)
 * =============================== */
function buildCommonFilters(req: Request) {
  const page = Math.max(parseInt(String(req.query.page ?? "1"), 10), 1);
  const limit = Math.max(parseInt(String(req.query.limit ?? "20"), 10), 1);
  const offset = (page - 1) * limit;

  const thang = req.query.thang !== undefined ? parseInt(String(req.query.thang), 10) : undefined;
  const nam = req.query.nam !== undefined ? parseInt(String(req.query.nam), 10) : undefined;
  const nhan_vien_id =
    req.query.nhan_vien_id !== undefined ? parseInt(String(req.query.nhan_vien_id), 10) : undefined;
  const q = (req.query.q as string | undefined)?.trim();

  const where: string[] = [];
  const params: any[] = [];

  if (typeof thang === "number" && !Number.isNaN(thang)) {
    where.push("l.thang = ?");
    params.push(thang);
  }
  if (typeof nam === "number" && !Number.isNaN(nam)) {
    where.push("l.nam = ?");
    params.push(nam);
  }
  if (typeof nhan_vien_id === "number" && !Number.isNaN(nhan_vien_id)) {
    where.push("l.nhan_vien_id = ?");
    params.push(nhan_vien_id);
  }
  if (q && q.length > 0) {
    // tìm theo họ tên nhân viên
    where.push("nv.ho_ten LIKE ?");
    params.push(`%${q}%`);
  }

  return { page, limit, offset, where, params };
}

/** ==============================
 * Helper: lấy phạm vi người dùng (employeeId & ds phòng ban manager quản lý)
 * Dùng cho GET /luong/:id và các chỗ cần scope chi tiết.
 * =============================== */
async function getUserScope(req: Request): Promise<{
  employeeId: number | null;
  managedDepartmentIds: number[];
  role: "admin" | "manager" | "employee";
  userId: number;
}> {
  const user = (req as any).user as { id: number; role: "admin" | "manager" | "employee" };

  // Lấy nhan_vien_id của tài khoản hiện tại
  const [[me]]: any = await pool.query(
    `SELECT nhan_vien_id AS employeeId FROM tai_khoan WHERE id = ? LIMIT 1`,
    [user.id]
  );
  const employeeId = me?.employeeId ?? null;

  // Nếu là manager → lấy danh sách id phòng ban do tài khoản này quản lý
  let managedDepartmentIds: number[] = [];
  if (user.role === "manager") {
    const [rows]: any = await pool.query(`SELECT id FROM phong_ban WHERE manager_taikhoan_id = ?`, [
      user.id,
    ]);
    managedDepartmentIds = rows.map((r: any) => r.id);
  }

  return { employeeId, managedDepartmentIds, role: user.role, userId: user.id };
}

/** ==============================
 * GET /luong
 *  - admin: xem toàn bộ
 *  - manager: chỉ xem nhân viên thuộc phòng ban mình quản lý
 *    (cần cột phong_ban.manager_taikhoan_id)
 * Query: page, limit, thang, nam, nhan_vien_id, q
 * =============================== */
router.get(
  "/",
  requireAuth,
  requireRole(["admin", "manager"]),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as { id: number; role: "admin" | "manager" };
      const { page, limit, offset, where, params } = buildCommonFilters(req);

      if (user.role === "manager") {
        // Giới hạn phạm vi quản lý theo phòng ban
        where.push("pb.manager_taikhoan_id = ?");
        params.push(user.id);
      }

      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const countSql = `
        SELECT COUNT(*) AS total
        FROM luong l
        JOIN nhan_vien nv ON nv.id = l.nhan_vien_id
        LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
        ${whereSql}
      `;
      const [countRows] = await pool.query(countSql, params);
      const total = (countRows as any[])[0]?.total ?? 0;

      const dataSql = `
        SELECT
          l.id,
          l.nhan_vien_id,
          nv.ho_ten,
          l.thang,
          l.nam,
          l.luong_co_ban,
          l.phu_cap,
          l.thuong,
          l.khau_tru,
          (COALESCE(l.luong_co_ban,0) + COALESCE(l.phu_cap,0) + COALESCE(l.thuong,0) - COALESCE(l.khau_tru,0)) AS tong_luong
        FROM luong l
        JOIN nhan_vien nv ON nv.id = l.nhan_vien_id
        LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
        ${whereSql}
        ORDER BY l.nam DESC, l.thang DESC, l.id DESC
        LIMIT ? OFFSET ?
      `;
      const dataParams = [...params, limit, offset];
      const [rows] = await pool.query(dataSql, dataParams);

      res.json({ page, limit, total, items: rows });
    } catch (err: any) {
      console.error("[GET /luong] error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

/** ==============================
 * GET /luong/me
 *  - admin | manager | employee: trả về lương của CHÍNH NGƯỜI DÙNG ĐANG ĐĂNG NHẬP
 *  - KHÔNG cho phép override nhan_vien_id qua query
 * Query: page, limit, thang, nam, q (q tìm theo tên mình cho tiện, không bắt buộc)
 * =============================== */
router.get(
  "/me",
  requireAuth,
  requireRole(["admin", "manager", "employee"]),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as { id: number };
      const page = Math.max(parseInt(String(req.query.page ?? "1"), 10), 1);
      const limit = Math.max(parseInt(String(req.query.limit ?? "50"), 10), 1);
      const offset = (page - 1) * limit;

      const thang =
        req.query.thang !== undefined ? parseInt(String(req.query.thang), 10) : undefined;
      const nam = req.query.nam !== undefined ? parseInt(String(req.query.nam), 10) : undefined;
      const q = (req.query.q as string | undefined)?.trim();

      const where: string[] = ["tk.id = ?"]; // ràng buộc đúng tài khoản hiện tại
      const params: any[] = [user.id];

      if (typeof thang === "number" && !Number.isNaN(thang)) {
        where.push("l.thang = ?");
        params.push(thang);
      }
      if (typeof nam === "number" && !Number.isNaN(nam)) {
        where.push("l.nam = ?");
        params.push(nam);
      }
      if (q && q.length > 0) {
        where.push("nv.ho_ten LIKE ?");
        params.push(`%${q}%`);
      }

      const whereSql = `WHERE ${where.join(" AND ")}`;

      const countSql = `
        SELECT COUNT(*) AS total
        FROM luong l
        JOIN nhan_vien nv ON nv.id = l.nhan_vien_id
        JOIN tai_khoan tk ON tk.nhan_vien_id = nv.id
        ${whereSql}
      `;
      const [countRows] = await pool.query(countSql, params);
      const total = (countRows as any[])[0]?.total ?? 0;

      const dataSql = `
        SELECT
          l.id,
          l.nhan_vien_id,
          nv.ho_ten,
          l.thang,
          l.nam,
          l.luong_co_ban,
          l.phu_cap,
          l.thuong,
          l.khau_tru,
          (COALESCE(l.luong_co_ban,0) + COALESCE(l.phu_cap,0) + COALESCE(l.thuong,0) - COALESCE(l.khau_tru,0)) AS tong_luong
        FROM luong l
        JOIN nhan_vien nv ON nv.id = l.nhan_vien_id
        JOIN tai_khoan tk ON tk.nhan_vien_id = nv.id
        ${whereSql}
        ORDER BY l.nam DESC, l.thang DESC, l.id DESC
        LIMIT ? OFFSET ?
      `;
      const dataParams = [...params, limit, offset];
      const [rows] = await pool.query(dataSql, dataParams);

      res.json({ page, limit, total, items: rows });
    } catch (err: any) {
      console.error("[GET /luong/me] error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

/** ==============================
 * GET /luong/:id
 *  - admin: xem mọi bản ghi
 *  - manager: chỉ xem nếu nhân viên thuộc phòng ban mình quản
 *  - employee: chỉ xem nếu đó là bản ghi của chính mình
 * =============================== */
router.get(
  "/:id",
  requireAuth,
  requireRole(["admin", "manager", "employee"]),
  async (req: Request<ParamsWithId>, res: Response) => {
    try {
      const { employeeId, managedDepartmentIds, role } = await getUserScope(req);
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "id không hợp lệ" });
      }

      const whereParts: string[] = ["l.id = ?"];
      const whereParams: any[] = [id];

      if (role === "manager") {
        if (managedDepartmentIds.length === 0) {
          return res.status(404).json({ message: "Không tìm thấy" });
        }
        // lương của NV thuộc phòng ban manager quản lý
        whereParts.push(`nv.phong_ban_id IN (${managedDepartmentIds.map(() => "?").join(",")})`);
        whereParams.push(...managedDepartmentIds);
      } else if (role === "employee") {
        if (!employeeId) {
          return res.status(404).json({ message: "Không tìm thấy" });
        }
        // chỉ lương của chính mình
        whereParts.push("l.nhan_vien_id = ?");
        whereParams.push(employeeId);
      }

      const whereSql = `WHERE ${whereParts.join(" AND ")}`;

      const sql = `
        SELECT
          l.id,
          l.nhan_vien_id,
          nv.ho_ten,
          l.thang,
          l.nam,
          l.luong_co_ban,
          l.phu_cap,
          l.thuong,
          l.khau_tru,
          (COALESCE(l.luong_co_ban,0) + COALESCE(l.phu_cap,0) + COALESCE(l.thuong,0) - COALESCE(l.khau_tru,0)) AS tong_luong,
          pb.ten_phong_ban
        FROM luong l
        JOIN nhan_vien nv ON nv.id = l.nhan_vien_id
        LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
        ${whereSql}
        LIMIT 1
      `;
      const [[row]]: any = await pool.query(sql, whereParams);

      if (!row) return res.status(404).json({ message: "Không tìm thấy" });
      res.json(row);
    } catch (err: any) {
      console.error("[GET /luong/:id] error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

/** ==============================
 * POST /luong
 *  - chỉ admin
 * =============================== */
router.post("/", requireAuth, requireRole(["admin"]), async (req: Request, res: Response) => {
  try {
    const { nhan_vien_id, thang, nam, luong_co_ban, phu_cap, thuong, khau_tru } = req.body || {};

    if (!nhan_vien_id || !thang || !nam || luong_co_ban === undefined || luong_co_ban === null) {
      return res.status(400).json({
        error: "nhan_vien_id, thang, nam, luong_co_ban là bắt buộc",
      });
    }

    const insertSql = `
      INSERT INTO luong
        (nhan_vien_id, thang, nam, luong_co_ban, phu_cap, thuong, khau_tru)
      VALUES
        (?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await pool.execute(insertSql, [
      nhan_vien_id,
      thang,
      nam,
      luong_co_ban,
      phu_cap ?? 0,
      thuong ?? 0,
      khau_tru ?? 0,
    ]);

    res.status(201).json({ id: (result as any).insertId });
  } catch (err: any) {
    console.error("[POST /luong] error:", {
      code: err?.code,
      errno: err?.errno,
      sqlMessage: err?.sqlMessage,
      sql: err?.sql,
    });
    res.status(500).json({ error: "Server error", code: err?.code, sqlMessage: err?.sqlMessage });
  }
});

/** ==============================
 * PUT /luong/:id
 *  - chỉ admin
 * =============================== */
router.put(
  "/:id",
  requireAuth,
  requireRole(["admin"]),
  async (req: Request<ParamsWithId>, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "id không hợp lệ" });
      }

      const allowed = [
        "nhan_vien_id",
        "thang",
        "nam",
        "luong_co_ban",
        "phu_cap",
        "thuong",
        "khau_tru",
      ] as const;
      const fields = allowed.filter((k) => req.body?.[k] !== undefined);

      if (!fields.length) {
        return res.status(400).json({ error: "Không có trường nào để cập nhật" });
      }

      const sets = fields.map((k) => `${k} = ?`).join(", ");
      const values = fields.map((k) => req.body[k]);

      const sql = `UPDATE luong SET ${sets} WHERE id = ?`;
      await pool.execute(sql, [...values, id]);

      res.json({ ok: true });
    } catch (err: any) {
      console.error("[PUT /luong/:id] error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

/** ==============================
 * DELETE /luong/:id
 *  - chỉ admin
 * =============================== */
router.delete(
  "/:id",
  requireAuth,
  requireRole(["admin"]),
  async (req: Request<ParamsWithId>, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "id không hợp lệ" });
      }

      await pool.execute("DELETE FROM luong WHERE id = ?", [id]);
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[DELETE /luong/:id] error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

export default router;
