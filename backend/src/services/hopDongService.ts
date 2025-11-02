// src/services/hopDongService.ts
import { Request } from "express";
import { pool } from "../db";

/**
 * Lấy phạm vi dữ liệu của user theo role
 */
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

/**
 * Cập nhật trạng thái các hợp đồng đã hết hạn
 */
export async function expireContractsIfNeeded() {
  try {
    await pool.query(
      `
      UPDATE hop_dong
      SET trang_thai = 'het_han'
      WHERE trang_thai = 'con_hieu_luc'
        AND ngay_ket_thuc IS NOT NULL
        AND DATE(ngay_ket_thuc) < CURDATE()
      `
    );
  } catch (err) {
    console.error("Lỗi khi cập nhật hợp đồng hết hạn:", err);
  }
}

/* ==================== LIST ==================== */
export const getAll = async (req: Request) => {
  await expireContractsIfNeeded();

  const { employeeId, managedDepartmentIds, role } = await getUserScope(req);

  const whereParts: string[] = [];
  const params: any[] = [];

  if (role === "manager") {
    if (managedDepartmentIds.length === 0) return [];
    whereParts.push(`nv.phong_ban_id IN (${managedDepartmentIds.map(() => "?").join(",")})`);
    params.push(...managedDepartmentIds);
  } else if (role === "employee") {
    if (!employeeId) return [];
    whereParts.push(`hd.nhan_vien_id = ?`);
    params.push(employeeId);
  } else {
    if ((req.query as any).mine === "1" && (req as any).user) {
      const [[me]]: any = await pool.query(
        "SELECT nhan_vien_id AS employeeId FROM tai_khoan WHERE id = ?",
        [(req as any).user.id]
      );
      if (me?.employeeId) {
        whereParts.push(`hd.nhan_vien_id = ?`);
        params.push(me.employeeId);
      }
    }
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

  return rows;
};

/* ==================== DETAIL ==================== */
export const getDetail = async (req: Request) => {
  await expireContractsIfNeeded();

  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return null;

  const { employeeId, managedDepartmentIds, role } = await getUserScope(req);

  const whereParts: string[] = [`hd.id = ?`];
  const params: any[] = [id];

  if (role === "manager") {
    if (managedDepartmentIds.length === 0) return null;
    whereParts.push(`nv.phong_ban_id IN (${managedDepartmentIds.map(() => "?").join(",")})`);
    params.push(...managedDepartmentIds);
  } else if (role === "employee") {
    if (!employeeId) return null;
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

  return rows[0] || null;
};

/* ==================== CREATE ==================== */
export const create = async (req: Request) => {
  const { role } = await getUserScope(req);
  if (role !== "admin") return { error: "Chỉ admin mới được tạo hợp đồng" };

  const {
    nhan_vien_id,
    so_hop_dong,
    loai_hop_dong,
    ngay_ky,
    ngay_bat_dau,
    ngay_ket_thuc,
    luong_thoa_thuan,
    phu_cap_co_dinh,
    phu_cap_tham_nien,
    phu_cap_nang_luc, // ✅ thêm mới
    phu_cap_trach_nhiem, // ✅ thêm mới
    ghi_chu,
    trang_thai,
    file_hop_dong,
  } = req.body;

  if (!nhan_vien_id || !so_hop_dong) return { error: "nhan_vien_id, so_hop_dong là bắt buộc" };
  if (!ngay_bat_dau) return { error: "Ngày bắt đầu hợp đồng là bắt buộc" };

  if (loai_hop_dong === "Không xác định thời hạn" && ngay_ket_thuc) {
    return { error: "Hợp đồng không xác định thời hạn không được có ngày kết thúc" };
  }

  const [existing]: any = await pool.query(
    `SELECT id FROM hop_dong WHERE nhan_vien_id = ? AND trang_thai = 'con_hieu_luc'`,
    [nhan_vien_id]
  );
  if (existing.length > 0) return { error: "Nhân viên này đã có hợp đồng còn hiệu lực." };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 🟢 Thêm đủ 5 cột phụ cấp
    const [r]: any = await conn.query(
      `INSERT INTO hop_dong
       (nhan_vien_id, so_hop_dong, loai_hop_dong, ngay_ky, ngay_bat_dau, ngay_ket_thuc,
        luong_thoa_thuan, phu_cap_co_dinh, phu_cap_tham_nien, phu_cap_nang_luc, phu_cap_trach_nhiem,
        ghi_chu, trang_thai, file_hop_dong)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nhan_vien_id,
        so_hop_dong,
        loai_hop_dong || null,
        ngay_ky || null,
        ngay_bat_dau,
        loai_hop_dong === "Không xác định thời hạn" ? null : ngay_ket_thuc || null,
        luong_thoa_thuan || 0,
        phu_cap_co_dinh || 0,
        phu_cap_tham_nien || 0,
        phu_cap_nang_luc || 0, // ✅ mới
        phu_cap_trach_nhiem || 0, // ✅ mới
        ghi_chu || null,
        trang_thai || "con_hieu_luc",
        file_hop_dong || null,
      ]
    );

    await conn.query(
      `UPDATE nhan_vien
       SET ngay_vao_lam = COALESCE(ngay_vao_lam, ?)
       WHERE id = ?`,
      [ngay_bat_dau, nhan_vien_id]
    );

    await conn.commit();
    return { data: { id: r.insertId, message: "Đã tạo hợp đồng thành công" } };
  } catch (err) {
    await conn.rollback();
    console.error("❌ Lỗi khi tạo hợp đồng:", err);
    return { error: "Không thể tạo hợp đồng" };
  } finally {
    conn.release();
  }
};

/* ==================== UPDATE ==================== */
export const update = async (id: number, req: Request) => {
  if (!Number.isFinite(id) || id <= 0) return null;

  const { role, managedDepartmentIds } = await getUserScope(req);
  if (role === "employee") return { error: "Nhân viên không có quyền sửa hợp đồng" };

  if (role === "manager") {
    const [rows]: any = await pool.query(
      `SELECT nv.phong_ban_id
       FROM hop_dong hd
       JOIN nhan_vien nv ON nv.id = hd.nhan_vien_id
       WHERE hd.id = ?`,
      [id]
    );
    if (!rows.length || !managedDepartmentIds.includes(rows[0].phong_ban_id)) {
      return { error: "Bạn không có quyền sửa hợp đồng này" };
    }
  }

  const {
    nhan_vien_id,
    so_hop_dong,
    loai_hop_dong,
    ngay_ky,
    ngay_bat_dau,
    ngay_ket_thuc,
    luong_thoa_thuan,
    phu_cap_co_dinh,
    phu_cap_tham_nien,
    phu_cap_nang_luc, // ✅ thêm mới
    phu_cap_trach_nhiem, // ✅ thêm mới
    ghi_chu,
    trang_thai,
    file_hop_dong,
  } = req.body;

  if (loai_hop_dong === "Không xác định thời hạn" && ngay_ket_thuc) {
    return { error: "Hợp đồng không xác định thời hạn không được có ngày kết thúc" };
  }

  if (trang_thai === "con_hieu_luc") {
    const [existing]: any = await pool.query(
      `SELECT id FROM hop_dong 
       WHERE nhan_vien_id = ? AND trang_thai = 'con_hieu_luc' AND id <> ?`,
      [nhan_vien_id, id]
    );
    if (existing.length > 0) return { error: "Nhân viên này đã có hợp đồng còn hiệu lực khác." };
  }

  const [r]: any = await pool.query(
    `UPDATE hop_dong SET
        nhan_vien_id=?, so_hop_dong=?, loai_hop_dong=?, ngay_ky=?, ngay_bat_dau=?, ngay_ket_thuc=?,
        luong_thoa_thuan=?, phu_cap_co_dinh=?, phu_cap_tham_nien=?, phu_cap_nang_luc=?, phu_cap_trach_nhiem=?,
        ghi_chu=?, trang_thai=?, file_hop_dong=?
     WHERE id=?`,
    [
      nhan_vien_id || null,
      so_hop_dong || null,
      loai_hop_dong || null,
      ngay_ky || null,
      ngay_bat_dau || null,
      loai_hop_dong === "Không xác định thời hạn" ? null : ngay_ket_thuc || null,
      luong_thoa_thuan || 0,
      phu_cap_co_dinh || 0,
      phu_cap_tham_nien || 0,
      phu_cap_nang_luc || 0, // ✅ mới
      phu_cap_trach_nhiem || 0, // ✅ mới
      ghi_chu || null,
      trang_thai || null,
      file_hop_dong || null,
      id,
    ]
  );

  return r.affectedRows > 0;
};

/* ==================== XOÁ ==================== */
export const remove = async (id: number, req: Request) => {
  if (!Number.isFinite(id) || id <= 0) return false;
  const { role } = await getUserScope(req);
  if (role !== "admin") return false;

  const [r]: any = await pool.query(`DELETE FROM hop_dong WHERE id=?`, [id]);
  return r.affectedRows > 0;
};
