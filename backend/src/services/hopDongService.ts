// src/services/hopDongService.ts
import { Request } from "express";
import { pool } from "../db";
import "../middlewares/auth"; // chỉ để load khai báo mở rộng Request

/**
 * Lấy phạm vi dữ liệu của user theo role
 */
async function getUserScope(req: Request): Promise<{
  employeeId: number | null;
  managedDepartmentIds: number[];
  role: "admin" | "manager" | "employee";
  isAccountingManager?: boolean;
}> {
  // Nếu middleware phân quyền chung đã set req.phamvi → ưu tiên dùng
  if (req.phamvi) {
    const scope = {
      employeeId: req.phamvi.employeeId ?? null,
      managedDepartmentIds: req.phamvi.managedDepartmentIds || [],
      role: req.phamvi.role,
      isAccountingManager: req.phamvi.isAccountingManager,
    } as {
      employeeId: number | null;
      managedDepartmentIds: number[];
      role: "admin" | "manager" | "employee";
      isAccountingManager?: boolean;
    };

    return scope;
  }

  // Fallback: logic cũ, phòng trường hợp route này chỉ dùng requireAuth
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
    role: user.role as "admin" | "manager" | "employee",
    // isAccountingManager: undefined
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

  const { employeeId, managedDepartmentIds, role, isAccountingManager } = await getUserScope(req);

  const { nhan_vien_id, loai_hop_dong, trang_thai, tu_ngay, den_ngay } = req.query as any;

  const whereParts: string[] = [];
  const params: any[] = [];

  /* ====== PHẠM VI THEO QUYỀN ====== */
  if (role === "manager") {
    // Manager thường: chỉ xem hợp đồng nhân viên thuộc phòng ban mình quản
    // Manager Kế toán (isAccountingManager === true): xem toàn bộ, không giới hạn phòng ban
    if (!isAccountingManager) {
      if (managedDepartmentIds.length === 0) return [];
      whereParts.push(`nv.phong_ban_id IN (${managedDepartmentIds.map(() => "?").join(",")})`);
      params.push(...managedDepartmentIds);
    }
  } else if (role === "employee") {
    if (!employeeId) return [];
    whereParts.push(`hd.nhan_vien_id = ?`);
    params.push(employeeId);
  } else {
    // admin → nếu mine=1 thì chỉ lấy theo user
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

  /* ====== FILTER BỔ SUNG ====== */
  if (nhan_vien_id) {
    whereParts.push(`hd.nhan_vien_id = ?`);
    params.push(nhan_vien_id);
  }

  if (loai_hop_dong) {
    whereParts.push(`hd.loai_hop_dong = ?`);
    params.push(loai_hop_dong);
  }

  if (trang_thai) {
    whereParts.push(`hd.trang_thai = ?`);
    params.push(trang_thai);
  }

  if (tu_ngay) {
    whereParts.push(`hd.ngay_ky >= ?`);
    params.push(tu_ngay);
  }

  if (den_ngay) {
    whereParts.push(`hd.ngay_ky <= ?`);
    params.push(den_ngay);
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

  const [rows]: any[] = await pool.query(
    `
    SELECT hd.*, nv.ho_ten, nv.phong_ban_id
    FROM hop_dong hd
    JOIN nhan_vien nv ON nv.id = hd.nhan_vien_id
    ${whereSql}
    ORDER BY hd.id DESC
  `,
    params
  );

  if (!rows.length) return rows;

  /* ======= LẤY PHỤ CẤP ======= */
  const hopDongIds = rows.map((r: any) => r.id);
  const [pcRows]: any[] = await pool.query(
    `
      SELECT 
        pct.hop_dong_id,
        pct.loai_id,
        pct.so_tien,
        loai.ten AS ten_phu_cap
      FROM phu_cap_chi_tiet pct
      JOIN phu_cap_loai loai ON loai.id = pct.loai_id
      WHERE pct.hop_dong_id IN (${hopDongIds.map(() => "?").join(",")})
    `,
    hopDongIds
  );

  const pcByContract: Record<number, any[]> = {};
  for (const pc of pcRows) {
    const hid = pc.hop_dong_id;
    if (!pcByContract[hid]) pcByContract[hid] = [];
    pcByContract[hid].push({
      id: pc.id,
      loai_id: pc.loai_id,
      ten_phu_cap: pc.ten_phu_cap,
      so_tien: Number(pc.so_tien || 0),
    });
  }

  return rows.map((r: any) => ({
    ...r,
    phu_caps: pcByContract[r.id] || [],
  }));
};

/* ==================== DETAIL ==================== */
export const getDetail = async (req: Request) => {
  await expireContractsIfNeeded();

  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return null;

  const { employeeId, managedDepartmentIds, role, isAccountingManager } = await getUserScope(req);

  const whereParts: string[] = [`hd.id = ?`];
  const params: any[] = [id];

  if (role === "manager") {
    // Manager kế toán: xem được chi tiết mọi hợp đồng (không giới hạn phòng ban)
    // Manager thường: chỉ xem chi tiết HĐ nhân viên phòng mình
    if (!isAccountingManager) {
      if (managedDepartmentIds.length === 0) return null;
      whereParts.push(`nv.phong_ban_id IN (${managedDepartmentIds.map(() => "?").join(",")})`);
      params.push(...managedDepartmentIds);
    }
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

  const hopDong = rows[0];
  if (!hopDong) return null;

  const [phuCaps] = await pool.query(
    `
      SELECT 
        pct.id,
        pct.loai_id,
        loai.ten AS ten_phu_cap,
        pct.so_tien
      FROM phu_cap_chi_tiet pct
      JOIN phu_cap_loai loai ON loai.id = pct.loai_id
      WHERE pct.hop_dong_id = ?
    `,
    [id]
  );

  return {
    ...hopDong,
    phu_caps: phuCaps || [],
  };
};

/* ==================== Helper: parse phu_caps từ req.body ==================== */
function parsePhuCaps(raw: any): { loai_id: number; so_tien: number }[] {
  if (!raw) return [];
  let data: any = raw;

  // Trường hợp gửi từ FormData: phu_caps là chuỗi JSON
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(data)) return [];

  return data
    .map((x) => ({
      loai_id: Number(x.loai_id),
      so_tien: Number(x.so_tien),
    }))
    .filter((x) => x.loai_id && !Number.isNaN(x.so_tien));
}

/* ==================== TẠO MỚI ==================== */
export const create = async (req: Request) => {
  const { role, managedDepartmentIds, isAccountingManager } = await getUserScope(req);

  // 1. Kiểm tra Quyền Tạo
  // - Admin: OK
  // - Manager kế toán: OK (dựa trên isAccountingManager từ phân quyền chung)
  // - Các manager khác / employee: KHÔNG
  const isKeToanManager = !!isAccountingManager;

  if (role !== "admin" && !isKeToanManager) {
    return { error: "Chỉ Admin hoặc Manager Phòng Kế Toán mới được tạo hợp đồng" };
  }

  const {
    nhan_vien_id,
    so_hop_dong,
    loai_hop_dong,
    ngay_ky,
    ngay_bat_dau,
    ngay_ket_thuc,
    luong_thoa_thuan,
    trang_thai,
    ghi_chu,
  } = req.body;

  const filePath = (req as any).file?.path || req.body.file_hop_dong;

  // 2. Kiểm tra dữ liệu bắt buộc
  if (!nhan_vien_id || !loai_hop_dong || !ngay_bat_dau || !luong_thoa_thuan) {
    return { error: "Vui lòng nhập đầy đủ thông tin bắt buộc" };
  }

  // 3. Xử lý logic loại hợp đồng
  let final_ngay_ket_thuc = null;
  if (loai_hop_dong === "Xác định thời hạn") {
    if (!ngay_ket_thuc) return { error: "Hợp đồng xác định thời hạn phải có ngày kết thúc" };
    final_ngay_ket_thuc = ngay_ket_thuc;
  }

  // 4. Transaction (GIỮ NGUYÊN)
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result]: any = await conn.query(
      `
      INSERT INTO hop_dong (
        nhan_vien_id, so_hop_dong, loai_hop_dong,
        ngay_ky, ngay_bat_dau, ngay_ket_thuc,
        luong_thoa_thuan, trang_thai, file_hop_dong, ghi_chu
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        nhan_vien_id,
        so_hop_dong ?? null,
        loai_hop_dong,
        ngay_ky ?? null,
        ngay_bat_dau,
        final_ngay_ket_thuc,
        luong_thoa_thuan,
        trang_thai ?? "con_hieu_luc",
        filePath ?? null,
        ghi_chu ?? null,
      ]
    );

    const newId = result.insertId;

    // AUTO UPDATE ngày_vao_lam như cũ
    const [[nv]]: any = await conn.query(
      `SELECT ngay_vao_lam FROM nhan_vien WHERE id = ? LIMIT 1`,
      [nhan_vien_id]
    );

    if (!nv?.ngay_vao_lam) {
      await conn.query(`UPDATE nhan_vien SET ngay_vao_lam = ? WHERE id = ?`, [
        ngay_bat_dau,
        nhan_vien_id,
      ]);
    }

    await conn.commit();
    return { success: true, id: newId };
  } catch (e) {
    await conn.rollback();
    console.error("Create hop_dong error:", e);
    return { error: "Lỗi hệ thống khi tạo hợp đồng" };
  } finally {
    conn.release();
  }
};

/* ==================== CẬP NHẬT ==================== */
export const update = async (id: number, req: Request) => {
  if (!Number.isFinite(id) || id <= 0) {
    return { error: "ID hợp đồng không hợp lệ" };
  }

  const { role, managedDepartmentIds, isAccountingManager } = await getUserScope(req);

  // 1. Kiểm tra Quyền
  if (role !== "admin") {
    const IS_KE_TOAN_MANAGER = !!isAccountingManager;

    if (!IS_KE_TOAN_MANAGER) {
      return { error: "Chỉ Admin hoặc Manager Phòng Kế Toán mới được sửa hợp đồng" };
    }

    // GIỮ NGUYÊN LOGIC CŨ: Manager Kế toán chỉ được sửa hợp đồng của nhân viên phòng Kế toán
    const [rows]: any = await pool.query(
      `
      SELECT nv.phong_ban_id
      FROM hop_dong hd
      JOIN nhan_vien nv ON nv.id = hd.nhan_vien_id
      WHERE hd.id = ?
      `,
      [id]
    );

    if (!rows.length || rows[0].phong_ban_id !== 5) {
      return { error: "Manager Kế toán chỉ được sửa hợp đồng của nhân viên Phòng Kế Toán" };
    }
  }

  // 2. Lấy dữ liệu cũ để tránh bị ghi đè
  const [[old]]: any = await pool.query(`SELECT * FROM hop_dong WHERE id = ?`, [id]);
  if (!old) return { error: "Không tìm thấy hợp đồng" };

  const {
    nhan_vien_id,
    so_hop_dong,
    loai_hop_dong,
    ngay_ky,
    ngay_bat_dau,
    ngay_ket_thuc,
    luong_thoa_thuan,
    trang_thai,
    ghi_chu,
  } = req.body;

  // 3. Xử lý file hợp đồng (GIỮ NGUYÊN)
  let finalFile = old.file_hop_dong;
  if ((req as any).file) {
    finalFile = (req as any).file.path;
  }

  // 4. Xử lý ngày kết thúc (GIỮ NGUYÊN)
  let final_ngay_ket_thuc = null;
  if (loai_hop_dong === "Xác định thời hạn") {
    final_ngay_ket_thuc = ngay_ket_thuc;
  }

  // 5. Validate tối thiểu
  if (!nhan_vien_id || !loai_hop_dong || !ngay_bat_dau || luong_thoa_thuan == null) {
    return { error: "Vui lòng nhập đầy đủ thông tin bắt buộc" };
  }

  // 6. Cập nhật (GIỮ NGUYÊN)
  const [r]: any = await pool.query(
    `
    UPDATE hop_dong SET
      nhan_vien_id = ?,
      so_hop_dong = ?,
      loai_hop_dong = ?,
      ngay_ky = ?,
      ngay_bat_dau = ?,
      ngay_ket_thuc = ?,
      luong_thoa_thuan = ?,
      ghi_chu = ?,
      trang_thai = ?,
      file_hop_dong = ?
    WHERE id = ?
  `,
    [
      nhan_vien_id,
      so_hop_dong ?? old.so_hop_dong,
      loai_hop_dong,
      ngay_ky ?? old.ngay_ky,
      ngay_bat_dau,
      loai_hop_dong === "Không xác định thời hạn" ? null : final_ngay_ket_thuc,
      luong_thoa_thuan,
      ghi_chu ?? old.ghi_chu,
      trang_thai ?? old.trang_thai,
      finalFile,
      id,
    ]
  );

  if (r.affectedRows === 0) return { error: "Không tìm thấy hợp đồng" };

  return { success: true };
};

/* ==================== XOÁ ==================== */
export const remove = async (id: number, req: Request) => {
  if (!Number.isFinite(id) || id <= 0) return { success: false };

  const { role } = await getUserScope(req);

  // 1. Kiểm tra Quyền Xóa: CHỈ ADMIN
  if (role !== "admin") return { error: "Chỉ Admin mới có quyền xóa hợp đồng" };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 2. Xoá phụ cấp liên quan trước
    await conn.query(`DELETE FROM phu_cap_chi_tiet WHERE hop_dong_id = ?`, [id]);

    // 3. Xoá hợp đồng
    const [r]: any = await conn.query(`DELETE FROM hop_dong WHERE id = ?`, [id]);

    if (r.affectedRows === 0) {
      await conn.rollback();
      return { error: "Không tìm thấy hợp đồng" };
    }

    await conn.commit();
    return { success: true };
  } catch (e) {
    await conn.rollback();
    console.error("Remove hop_dong error:", e);
    return { error: "Lỗi hệ thống khi xóa hợp đồng" };
  } finally {
    conn.release();
  }
};
