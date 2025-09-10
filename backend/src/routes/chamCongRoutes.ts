// src/routes/chamCongRoutes.ts
import { Router, Request } from "express";
import { pool } from "../db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

/** Helper: lấy phạm vi người dùng hiện tại */
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
 * GET /cham-cong?from&to&nhan_vien_id
 * - admin: xem tất cả (có thể lọc nhan_vien_id)
 * - manager: chỉ xem NV trong phòng ban mình
 * - employee: chỉ xem chính mình
 * ============================== */
router.get("/", requireAuth, requireRole(["admin", "manager", "employee"]), async (req, res) => {
  const { employeeId, managedDepartmentIds, role } = await getUserScope(req);

  const from = String(req.query.from || ""); // yyyy-mm-dd
  const to = String(req.query.to || "");
  const nhan_vien_id = Number(req.query.nhan_vien_id);

  const where: string[] = [];
  const params: any[] = [];

  if (from) {
    where.push("cc.ngay >= ?");
    params.push(from);
  }
  if (to) {
    where.push("cc.ngay <= ?");
    params.push(to);
  }

  if (role === "manager") {
    if (managedDepartmentIds.length === 0) return res.json([]);
    where.push(`nv.phong_ban_id IN (${managedDepartmentIds.map(() => "?").join(",")})`);
    params.push(...managedDepartmentIds);
  } else if (role === "employee") {
    if (!employeeId) return res.json([]);
    where.push("cc.nhan_vien_id = ?");
    params.push(employeeId);
  } else {
    // admin được phép lọc theo nhan_vien_id nếu truyền vào
    if (Number.isInteger(nhan_vien_id)) {
      where.push("cc.nhan_vien_id = ?");
      params.push(nhan_vien_id);
    }
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `
      SELECT cc.*, nv.ho_ten, pb.ten_phong_ban
      FROM cham_cong cc
      JOIN nhan_vien nv ON nv.id = cc.nhan_vien_id
      LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
      ${whereSql}
      ORDER BY cc.ngay DESC, cc.id DESC
      `,
    params
  );

  res.json(rows);
});

/** ==============================
 * GET /cham-cong/:id
 * - admin: xem tất cả
 * - manager: chỉ xem nếu thuộc PB mình
 * - employee: chỉ xem nếu của chính mình
 * ============================== */
router.get("/:id", requireAuth, requireRole(["admin", "manager", "employee"]), async (req, res) => {
  const { employeeId, managedDepartmentIds, role } = await getUserScope(req);
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ message: "ID không hợp lệ" });

  const where: string[] = ["cc.id = ?"];
  const params: any[] = [id];

  if (role === "manager") {
    if (managedDepartmentIds.length === 0)
      return res.status(404).json({ message: "Không tìm thấy" });
    where.push(`nv.phong_ban_id IN (${managedDepartmentIds.map(() => "?").join(",")})`);
    params.push(...managedDepartmentIds);
  } else if (role === "employee") {
    if (!employeeId) return res.status(404).json({ message: "Không tìm thấy" });
    where.push("cc.nhan_vien_id = ?");
    params.push(employeeId);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;

  const [[row]]: any = await pool.query(
    `
      SELECT cc.*, nv.ho_ten, pb.ten_phong_ban
      FROM cham_cong cc
      JOIN nhan_vien nv ON nv.id = cc.nhan_vien_id
      LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
      ${whereSql}
      LIMIT 1
      `,
    params
  );

  if (!row) return res.status(404).json({ message: "Không tìm thấy" });
  res.json(row);
});

/** ==============================
 * POST /cham-cong
 * - admin: tạo cho mọi NV
 * - manager: chỉ tạo cho NV thuộc PB mình
 * - employee: không được tạo
 * ============================== */
router.post("/", requireAuth, requireRole(["admin", "manager"]), async (req, res) => {
  const { managedDepartmentIds, role } = await getUserScope(req);
  const { nhan_vien_id, ngay, check_in, check_out, ghi_chu } = req.body || {};

  if (!nhan_vien_id || !ngay) {
    return res.status(400).json({ message: "nhan_vien_id, ngay là bắt buộc" });
  }

  if (role === "manager") {
    if (managedDepartmentIds.length === 0) {
      return res.status(403).json({ message: "Bạn không có quyền tạo cho nhân viên này" });
    }
    const [ok]: any = await pool.query(
      `
        SELECT nv.id
        FROM nhan_vien nv
        WHERE nv.id = ? AND nv.phong_ban_id IN (${managedDepartmentIds.map(() => "?").join(",")})
        `,
      [nhan_vien_id, ...managedDepartmentIds]
    );
    if (!ok.length) {
      return res.status(403).json({ message: "Bạn không có quyền tạo cho nhân viên này" });
    }
  }

  const [r]: any = await pool.query(
    `
      INSERT INTO cham_cong (nhan_vien_id, ngay, check_in, check_out, ghi_chu)
      VALUES (?, ?, ?, ?, ?)
      `,
    [nhan_vien_id, ngay, check_in || null, check_out || null, ghi_chu || null]
  );
  res.status(201).json({ id: r.insertId, message: "OK" });
});

/** ==============================
 * PUT /cham-cong/:id
 * - admin: cập nhật mọi bản ghi
 * - manager: (tuỳ chọn) nếu muốn cho phép → kiểm tra NV thuộc PB mình
 * ============================== */
router.put(
  "/:id",
  requireAuth,
  requireRole(["admin"]), // nếu muốn mở cho manager: đổi ["admin","manager"] và thêm kiểm tra tương tự POST
  async (req, res) => {
    const id = Number(req.params.id);
    const { nhan_vien_id, ngay, check_in, check_out, ghi_chu } = req.body || {};
    if (!Number.isFinite(id) || id <= 0)
      return res.status(400).json({ message: "ID không hợp lệ" });

    const [r]: any = await pool.query(
      `
      UPDATE cham_cong
      SET nhan_vien_id=?, ngay=?, check_in=?, check_out=?, ghi_chu=?
      WHERE id=?
      `,
      [nhan_vien_id || null, ngay || null, check_in || null, check_out || null, ghi_chu || null, id]
    );
    if (!r.affectedRows) return res.status(404).json({ message: "Không tìm thấy" });
    res.json({ message: "Đã cập nhật" });
  }
);

/** ==============================
 * DELETE /cham-cong/:id
 * - chỉ admin
 * ============================== */
router.delete("/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ message: "ID không hợp lệ" });

  const [r]: any = await pool.query("DELETE FROM cham_cong WHERE id = ?", [id]);
  if (!r.affectedRows) return res.status(404).json({ message: "Không tìm thấy" });
  res.json({ message: "Đã xoá" });
});

export default router;
