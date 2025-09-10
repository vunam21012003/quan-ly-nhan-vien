// src/routes/hopDongRoutes.ts
import { Router, Request } from "express";
import { pool } from "../db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

/** Helper: lấy phạm vi của người dùng hiện tại */
async function getUserScope(req: Request): Promise<{
  employeeId: number | null;
  managedDepartmentIds: number[];
  role: "admin" | "manager" | "employee";
}> {
  const user = (req as any).user;

  const [[me]]: any = await pool.query(
    "SELECT nhan_vien_id AS employeeId FROM tai_khoan WHERE id = ?",
    [user.id]
  );

  let managedDepartmentIds: number[] = [];
  if (user.role === "manager") {
    const [rows]: any = await pool.query("SELECT id FROM phong_ban WHERE manager_taikhoan_id = ?", [
      user.id,
    ]);
    managedDepartmentIds = rows.map((r: any) => r.id);
  }

  return {
    employeeId: me?.employeeId ?? null,
    managedDepartmentIds,
    role: user.role,
  };
}

/** ==============================
 * GET /hop-dong
 * - admin: tất cả
 * - manager: NV trong phòng ban quản lý
 * - employee: chỉ bản thân
 * ============================== */
router.get(
  "/",
  requireAuth,
  requireRole(["admin", "manager", "employee"]),
  async (req, res, next) => {
    try {
      const { employeeId, managedDepartmentIds, role } = await getUserScope(req);

      const whereParts: string[] = [];
      const params: any[] = [];

      if (role === "manager") {
        if (managedDepartmentIds.length === 0) return res.json([]);
        whereParts.push(`nv.phong_ban_id IN (${managedDepartmentIds.map(() => "?").join(",")})`);
        params.push(...managedDepartmentIds);
      } else if (role === "employee") {
        if (!employeeId) return res.json([]);
        whereParts.push(`hd.nhan_vien_id = ?`);
        params.push(employeeId);
      }

      const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

      const [rows] = await pool.query(
        `
        SELECT hd.*, nv.ho_ten
        FROM hop_dong hd
        JOIN nhan_vien nv ON nv.id = hd.nhan_vien_id
        ${whereSql}
        ORDER BY hd.id DESC
        `,
        params
      );

      res.json(rows);
    } catch (e) {
      next(e);
    }
  }
);

/** ==============================
 * GET /hop-dong/:id
 * - admin: tất cả
 * - manager: nếu NV trong phòng ban quản lý
 * - employee: nếu là chính mình
 * ============================== */
router.get(
  "/:id",
  requireAuth,
  requireRole(["admin", "manager", "employee"]),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0)
        return res.status(400).json({ message: "ID không hợp lệ" });

      const { employeeId, managedDepartmentIds, role } = await getUserScope(req);

      const whereParts: string[] = [`hd.id = ?`];
      const params: any[] = [id];

      if (role === "manager") {
        if (managedDepartmentIds.length === 0)
          return res.status(404).json({ message: "Không tìm thấy" });
        whereParts.push(`nv.phong_ban_id IN (${managedDepartmentIds.map(() => "?").join(",")})`);
        params.push(...managedDepartmentIds);
      } else if (role === "employee") {
        if (!employeeId) return res.status(404).json({ message: "Không tìm thấy" });
        whereParts.push(`hd.nhan_vien_id = ?`);
        params.push(employeeId);
      }

      const whereSql = `WHERE ${whereParts.join(" AND ")}`;

      const [rows]: any = await pool.query(
        `
        SELECT hd.*, nv.ho_ten
        FROM hop_dong hd
        JOIN nhan_vien nv ON nv.id = hd.nhan_vien_id
        ${whereSql}
        `,
        params
      );

      if (!rows.length) return res.status(404).json({ message: "Không tìm thấy" });

      res.json(rows[0]);
    } catch (e) {
      next(e);
    }
  }
);

/** ==============================
 * POST /hop-dong
 * - chỉ admin
 * ============================== */
router.post("/", requireAuth, requireRole(["admin"]), async (req, res, next) => {
  try {
    const {
      nhan_vien_id,
      so_hop_dong,
      loai_hop_dong,
      ngay_ky,
      ngay_bat_dau,
      ngay_ket_thuc,
      luong_thoa_thuan,
      ghi_chu,
      trang_thai,
    } = req.body || {};

    if (!nhan_vien_id || !so_hop_dong)
      return res.status(400).json({ message: "nhan_vien_id, so_hop_dong là bắt buộc" });

    const [r]: any = await pool.query(
      `INSERT INTO hop_dong
         (nhan_vien_id, so_hop_dong, loai_hop_dong, ngay_ky, ngay_bat_dau, ngay_ket_thuc,
          luong_thoa_thuan, ghi_chu, trang_thai)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nhan_vien_id,
        so_hop_dong,
        loai_hop_dong || null,
        ngay_ky || null,
        ngay_bat_dau || null,
        ngay_ket_thuc || null,
        luong_thoa_thuan || 0,
        ghi_chu || null,
        trang_thai || null,
      ]
    );
    res.status(201).json({ id: r.insertId, message: "OK" });
  } catch (e) {
    next(e);
  }
});

/** ==============================
 * PUT /hop-dong/:id
 * - chỉ admin
 * ============================== */
router.put("/:id", requireAuth, requireRole(["admin"]), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      return res.status(400).json({ message: "ID không hợp lệ" });

    const {
      nhan_vien_id,
      so_hop_dong,
      loai_hop_dong,
      ngay_ky,
      ngay_bat_dau,
      ngay_ket_thuc,
      luong_thoa_thuan,
      ghi_chu,
      trang_thai,
    } = req.body || {};

    const [r]: any = await pool.query(
      `UPDATE hop_dong SET
          nhan_vien_id=?, so_hop_dong=?, loai_hop_dong=?, ngay_ky=?, ngay_bat_dau=?, ngay_ket_thuc=?,
          luong_thoa_thuan=?, ghi_chu=?, trang_thai=?
         WHERE id=?`,
      [
        nhan_vien_id || null,
        so_hop_dong || null,
        loai_hop_dong || null,
        ngay_ky || null,
        ngay_bat_dau || null,
        ngay_ket_thuc || null,
        luong_thoa_thuan || 0,
        ghi_chu || null,
        trang_thai || null,
        id,
      ]
    );
    if (!r.affectedRows) return res.status(404).json({ message: "Không tìm thấy" });
    res.json({ message: "Đã cập nhật" });
  } catch (e) {
    next(e);
  }
});

/** ==============================
 * DELETE /hop-dong/:id
 * - chỉ admin
 * ============================== */
router.delete("/:id", requireAuth, requireRole(["admin"]), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      return res.status(400).json({ message: "ID không hợp lệ" });

    const [r]: any = await pool.query(`DELETE FROM hop_dong WHERE id=?`, [id]);
    if (!r.affectedRows) return res.status(404).json({ message: "Không tìm thấy" });
    res.json({ message: "Đã xoá" });
  } catch (e) {
    next(e);
  }
});

export default router;
