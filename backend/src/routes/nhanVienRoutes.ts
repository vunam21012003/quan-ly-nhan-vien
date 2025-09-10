// src/routes/nhanVienRoutes.ts
import { Router, Request } from "express";
import { pool } from "../db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

/** Helper: lấy phạm vi dữ liệu theo user hiện tại (employeeId & phòng ban manager quản lý) */
async function getUserScope(req: Request): Promise<{
  employeeId: number | null;
  managedDepartmentIds: number[];
}> {
  const user = (req as any).user as { id: number; role: "admin" | "manager" | "employee" };

  // Lấy nhan_vien_id từ bảng tài_khoan (để biết "bản thân" của employee/manager)
  const [[me]]: any = await pool.query(
    `SELECT nhan_vien_id AS employeeId FROM tai_khoan WHERE id = ? LIMIT 1`,
    [user.id]
  );
  const employeeId = me?.employeeId ?? null;

  // Nếu là manager → lấy danh sách phòng ban do tài khoản này quản lý
  let managedDepartmentIds: number[] = [];
  if (user.role === "manager") {
    const [rows]: any = await pool.query(`SELECT id FROM phong_ban WHERE manager_taikhoan_id = ?`, [
      user.id,
    ]);
    managedDepartmentIds = rows.map((r: any) => r.id);
  }

  return { employeeId, managedDepartmentIds };
}

/** =========================
 *  GET /nhan-vien?page=&limit=&q=
 *  - admin: xem tất cả
 *  - manager: chỉ thấy nhân viên thuộc phòng ban mình quản lý
 *  - employee: chỉ thấy chính mình
 * ========================== */
router.get(
  "/",
  requireAuth,
  requireRole(["admin", "manager", "employee"]),
  async (req, res, next) => {
    try {
      const user = (req as any).user as { role: "admin" | "manager" | "employee" };
      const { employeeId, managedDepartmentIds } = await getUserScope(req);

      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Number(req.query.limit) || 20);
      const offset = (page - 1) * limit;
      const q = String(req.query.q || "").trim();

      const whereParts: string[] = [];
      const whereParams: any[] = [];

      if (q) {
        whereParts.push(
          `(nv.ho_ten LIKE ? OR nv.email LIKE ? OR pb.ten_phong_ban LIKE ? OR cv.ten_chuc_vu LIKE ?)`
        );
        whereParams.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
      }

      if (user.role === "manager") {
        if (managedDepartmentIds.length === 0) {
          return res.json({ items: [], total: 0, page, limit });
        }
        // Giới hạn theo danh sách phòng ban do manager quản lý
        whereParts.push(`nv.phong_ban_id IN (${managedDepartmentIds.map(() => "?").join(",")})`);
        whereParams.push(...managedDepartmentIds);
      } else if (user.role === "employee") {
        // Chỉ xem chính mình
        if (!employeeId) {
          return res.json({ items: [], total: 0, page, limit });
        }
        whereParts.push(`nv.id = ?`);
        whereParams.push(employeeId);
      }

      const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

      const [rows]: any = await pool.query(
        `
        SELECT nv.id, nv.ho_ten, nv.gioi_tinh, nv.ngay_sinh, nv.email, nv.so_dien_thoai,
               nv.dia_chi, nv.ngay_vao_lam, nv.trang_thai,
               nv.chuc_vu_id, cv.ten_chuc_vu,
               nv.phong_ban_id, pb.ten_phong_ban
        FROM nhan_vien nv
        LEFT JOIN chuc_vu  cv ON cv.id = nv.chuc_vu_id
        LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
        ${whereSql}
        ORDER BY nv.id DESC
        LIMIT ? OFFSET ?
        `,
        [...whereParams, limit, offset]
      );

      const [[countRow]]: any = await pool.query(
        `
        SELECT COUNT(*) AS total
        FROM nhan_vien nv
        LEFT JOIN chuc_vu  cv ON cv.id = nv.chuc_vu_id
        LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
        ${whereSql}
        `,
        whereParams
      );

      res.json({ items: rows, total: countRow?.total || 0, page, limit });
    } catch (e) {
      next(e);
    }
  }
);

/** =========================
 *  GET /nhan-vien/:id
 *  - admin: xem mọi bản ghi
 *  - manager: chỉ xem được nếu nhân viên thuộc phòng ban mình quản
 *  - employee: chỉ xem được nếu chính mình
 * ========================== */
router.get(
  "/:id",
  requireAuth,
  requireRole(["admin", "manager", "employee"]),
  async (req, res, next) => {
    try {
      const user = (req as any).user as { role: "admin" | "manager" | "employee" };
      const { employeeId, managedDepartmentIds } = await getUserScope(req);
      const id = Number(req.params.id);

      const whereParts: string[] = [`nv.id = ?`];
      const whereParams: any[] = [id];

      if (user.role === "manager") {
        if (managedDepartmentIds.length === 0) {
          return res.status(404).json({ message: "Không tìm thấy" });
        }
        whereParts.push(`nv.phong_ban_id IN (${managedDepartmentIds.map(() => "?").join(",")})`);
        whereParams.push(...managedDepartmentIds);
      } else if (user.role === "employee") {
        if (!employeeId) {
          return res.status(404).json({ message: "Không tìm thấy" });
        }
        // Chỉ cho xem chính mình
        whereParts.push(`nv.id = ?`);
        whereParams.push(employeeId);
      }

      const whereSql = `WHERE ${whereParts.join(" AND ")}`;

      const [[row]]: any = await pool.query(
        `
        SELECT nv.id, nv.ho_ten, nv.gioi_tinh, nv.ngay_sinh, nv.email, nv.so_dien_thoai,
               nv.dia_chi, nv.ngay_vao_lam, nv.trang_thai,
               nv.chuc_vu_id, cv.ten_chuc_vu,
               nv.phong_ban_id, pb.ten_phong_ban
        FROM nhan_vien nv
        LEFT JOIN chuc_vu  cv ON cv.id = nv.chuc_vu_id
        LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
        ${whereSql}
        LIMIT 1
        `,
        whereParams
      );

      if (!row) return res.status(404).json({ message: "Không tìm thấy" });
      res.json(row);
    } catch (e) {
      next(e);
    }
  }
);

/** =========================
 *  POST /nhan-vien
 *  - chỉ admin
 * ========================== */
router.post("/", requireAuth, requireRole(["admin"]), async (req, res, next) => {
  try {
    const {
      ho_ten,
      gioi_tinh, // 'Nam' | 'Nữ' (bắt buộc)
      ngay_sinh,
      dia_chi,
      so_dien_thoai,
      email,
      phong_ban_id,
      chuc_vu_id,
      ngay_vao_lam,
      trang_thai, // mặc định 'hoat_dong'
    } = req.body || {};

    if (!ho_ten) return res.status(400).json({ message: "ho_ten là bắt buộc" });
    if (!gioi_tinh || !["Nam", "Nữ"].includes(gioi_tinh))
      return res.status(400).json({ message: "gioi_tinh phải là 'Nam' hoặc 'Nữ'" });

    const [r]: any = await pool.query(
      `INSERT INTO nhan_vien
         (ho_ten, gioi_tinh, ngay_sinh, dia_chi, so_dien_thoai, email,
          phong_ban_id, chuc_vu_id, ngay_vao_lam, trang_thai)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ho_ten,
        gioi_tinh,
        ngay_sinh || null,
        dia_chi || null,
        so_dien_thoai || null,
        email || null,
        phong_ban_id || null,
        chuc_vu_id || null,
        ngay_vao_lam || null,
        trang_thai || "hoat_dong",
      ]
    );

    res.status(201).json({ id: r.insertId, message: "OK" });
  } catch (e) {
    next(e);
  }
});

/** =========================
 *  PUT /nhan-vien/:id
 *  - chỉ admin
 * ========================== */
router.put("/:id", requireAuth, requireRole(["admin"]), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const {
      ho_ten,
      gioi_tinh, // có thể cập nhật, nếu gửi phải hợp lệ
      ngay_sinh,
      dia_chi,
      so_dien_thoai,
      email,
      phong_ban_id,
      chuc_vu_id,
      ngay_vao_lam,
      trang_thai,
    } = req.body || {};

    if (gioi_tinh && !["Nam", "Nữ"].includes(gioi_tinh))
      return res.status(400).json({ message: "gioi_tinh phải là 'Nam' hoặc 'Nữ'" });

    const [r]: any = await pool.query(
      `UPDATE nhan_vien
         SET ho_ten=?, gioi_tinh=?, ngay_sinh=?, dia_chi=?, so_dien_thoai=?, email=?,
             phong_ban_id=?, chuc_vu_id=?, ngay_vao_lam=?, trang_thai=?
         WHERE id=?`,
      [
        ho_ten || null,
        gioi_tinh || null,
        ngay_sinh || null,
        dia_chi || null,
        so_dien_thoai || null,
        email || null,
        phong_ban_id || null,
        chuc_vu_id || null,
        ngay_vao_lam || null,
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

/** =========================
 *  PATCH /nhan-vien/:id
 *  - chỉ admin
 * ========================== */
router.patch("/:id", requireAuth, requireRole(["admin"]), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "id không hợp lệ" });

    // Chỉ cho phép sửa các field sau
    const allowed: Record<string, string> = {
      ho_ten: "ho_ten",
      gioi_tinh: "gioi_tinh", // 'Nam' | 'Nữ'
      ngay_sinh: "ngay_sinh",
      dia_chi: "dia_chi",
      so_dien_thoai: "so_dien_thoai",
      email: "email",
      phong_ban_id: "phong_ban_id",
      chuc_vu_id: "chuc_vu_id",
      ngay_vao_lam: "ngay_vao_lam",
      trang_thai: "trang_thai",
    };

    const body = req.body || {};
    const sets: string[] = [];
    const params: any[] = [];

    // Validate & build SET ... = ?
    for (const k of Object.keys(body)) {
      if (!(k in allowed)) continue; // bỏ qua field lạ

      const col = allowed[k];
      const val = body[k];

      // validate riêng
      if (k === "gioi_tinh") {
        if (val === undefined) continue;
        if (val === null) return res.status(400).json({ message: "gioi_tinh không được null" });
        if (!["Nam", "Nữ"].includes(String(val)))
          return res.status(400).json({ message: "gioi_tinh phải là 'Nam' hoặc 'Nữ'" });
      }

      if (k === "ho_ten" && val === null)
        return res.status(400).json({ message: "ho_ten không được null" });

      sets.push(`${col} = ?`);
      params.push(val);
    }

    if (sets.length === 0) {
      return res.status(400).json({ message: "Không có trường nào để cập nhật" });
    }

    // Kiểm tra FK nếu người dùng gửi lên
    if ("phong_ban_id" in body && body.phong_ban_id !== null && body.phong_ban_id !== undefined) {
      const [pb]: any = await pool.query("SELECT id FROM phong_ban WHERE id=?", [
        body.phong_ban_id,
      ]);
      if (!pb.length) return res.status(400).json({ message: "phong_ban_id không tồn tại" });
    }
    if ("chuc_vu_id" in body && body.chuc_vu_id !== null && body.chuc_vu_id !== undefined) {
      const [cv]: any = await pool.query("SELECT id FROM chuc_vu WHERE id=?", [body.chuc_vu_id]);
      if (!cv.length) return res.status(400).json({ message: "chuc_vu_id không tồn tại" });
    }

    // Thực hiện update chỉ các field đã gửi
    const sql = `UPDATE nhan_vien SET ${sets.join(", ")} WHERE id = ?`;
    params.push(id);

    const [r]: any = await pool.query(sql, params);
    if (!r.affectedRows) return res.status(404).json({ message: "Không tìm thấy" });

    res.json({ message: "Đã cập nhật", changed: r.changedRows || sets.length });
  } catch (e) {
    next(e);
  }
});

/** =========================
 *  DELETE /nhan-vien/:id
 *  - chỉ admin
 *  - ?force=true: xóa cưỡng bức (xóa dữ liệu phụ thuộc rồi xóa nhân viên)
 * ========================== */
router.delete("/:id", requireAuth, requireRole(["admin"]), async (req, res, next) => {
  const id = Number(req.params.id);
  const force = String(req.query.force || "") === "true";

  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ message: "ID không hợp lệ" });
  }

  // Nếu không force => xóa trực tiếp như cũ
  if (!force) {
    try {
      const [r]: any = await pool.query("DELETE FROM nhan_vien WHERE id = ?", [id]);
      if (!r.affectedRows)
        return res.status(404).json({ message: "Không tìm thấy nhân viên để xóa" });
      return res.json({ message: "Đã xóa nhân viên" });
    } catch (e) {
      return next(e);
    }
  }

  // FORCE DELETE: dùng transaction
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Xóa dữ liệu phụ thuộc (liệt kê đúng các bảng tham chiếu nhan_vien_id trong hệ thống bạn)
    const tables = ["cham_cong", "phan_tich_cong", "hop_dong", "lich_su_tra_luong", "luong"];
    for (const t of tables) {
      try {
        await conn.query(`DELETE FROM ${t} WHERE nhan_vien_id = ?`, [id]);
      } catch (err: any) {
        const msg = String(err?.message || "");
        if (!/doesn't exist|unknown table|unknown column/i.test(msg)) throw err;
      }
    }

    const [r]: any = await conn.query("DELETE FROM nhan_vien WHERE id = ?", [id]);
    if (!r.affectedRows) {
      await conn.rollback();
      return res.status(404).json({ message: "Không tìm thấy nhân viên để xóa" });
    }

    await conn.commit();
    return res.json({ message: "Đã xóa (force)" });
  } catch (e) {
    await conn.rollback();
    return next(e);
  } finally {
    conn.release();
  }
});

export default router;
