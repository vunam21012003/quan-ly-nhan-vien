// src/services/hopDongService.ts
import { Request } from "express";
import { pool } from "../db";
import "../middlewares/auth";

/**
 * Lấy phạm vi dữ liệu của user theo role
 */
async function getUserScope(req: Request): Promise<{
  employeeId: number | null;
  managedDepartmentIds: number[];
  role: "admin" | "manager" | "employee";
  isAccountingManager?: boolean;
}> {
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

/* ==================== LẤY LƯƠNG CƠ BẢN THEO NHÂN VIÊN ==================== */
export const getSalaryInfo = async (req: Request) => {
  const nhanVienId = Number(req.params.nhanVienId);
  if (!Number.isFinite(nhanVienId) || nhanVienId <= 0) {
    return { error: "ID nhân viên không hợp lệ" };
  }

  const [rows]: any = await pool.query(
    `
    SELECT 
      nv.id,
      nv.ho_ten,
      nv.chuc_vu_id,
      cv.ten_chuc_vu,
      cv.muc_luong_co_ban
    FROM nhan_vien nv
    LEFT JOIN chuc_vu cv ON cv.id = nv.chuc_vu_id
    WHERE nv.id = ?
    `,
    [nhanVienId]
  );

  if (!rows.length) return { error: "Không tìm thấy nhân viên" };

  return {
    id: rows[0].id,
    ho_ten: rows[0].ho_ten,
    chuc_vu_id: rows[0].chuc_vu_id,
    ten_chuc_vu: rows[0].ten_chuc_vu,
    muc_luong_co_ban: Number(rows[0].muc_luong_co_ban || 0),
  };
};

/* ==================== LẤY DANH SÁCH LOẠI PHỤ CẤP ==================== */
export const getPhuCapLoai = async () => {
  const [rows]: any = await pool.query(
    `SELECT id, ten, mo_ta, mac_dinh, is_fixed FROM phu_cap_loai ORDER BY ten`
  );
  return rows;
};

/* ==================== LIST ==================== */
export const getAll = async (req: Request) => {
  await expireContractsIfNeeded();

  const { employeeId, managedDepartmentIds, role, isAccountingManager } = await getUserScope(req);

  const { nhan_vien_id, loai_hop_dong, trang_thai, tu_ngay, den_ngay } = req.query as any;

  const whereParts: string[] = [];
  const params: any[] = [];

  if (role === "manager") {
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
    .filter((x) => x.loai_id && !Number.isNaN(x.so_tien) && x.so_tien > 0);
}

/* ==================== TẠO MỚI ==================== */
export const create = async (req: Request) => {
  const { role, isAccountingManager } = await getUserScope(req);

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
    phu_caps, // Mảng phụ cấp
  } = req.body;

  const filePath = (req as any).file?.path || req.body.file_hop_dong;

  if (!nhan_vien_id || !loai_hop_dong || !ngay_bat_dau) {
    return { error: "Vui lòng nhập đầy đủ thông tin bắt buộc" };
  }

  // Lấy lương cơ bản nếu không nhập lương thỏa thuận
  let finalLuong = luong_thoa_thuan;
  if (!finalLuong || Number(finalLuong) === 0) {
    const [[nvInfo]]: any = await pool.query(
      `
      SELECT cv.muc_luong_co_ban
      FROM nhan_vien nv
      LEFT JOIN chuc_vu cv ON cv.id = nv.chuc_vu_id
      WHERE nv.id = ?
      `,
      [nhan_vien_id]
    );

    finalLuong = nvInfo?.muc_luong_co_ban || 0;
  }

  let final_ngay_ket_thuc = null;
  if (loai_hop_dong === "Xác định thời hạn") {
    if (!ngay_ket_thuc) return { error: "Hợp đồng xác định thời hạn phải có ngày kết thúc" };
    final_ngay_ket_thuc = ngay_ket_thuc;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Tạo hợp đồng
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
        finalLuong,
        trang_thai ?? "con_hieu_luc",
        filePath ?? null,
        ghi_chu ?? null,
      ]
    );

    const newId = result.insertId;

    // Lưu phụ cấp
    const phuCapList = parsePhuCaps(phu_caps);
    if (phuCapList.length > 0) {
      const now = new Date();
      const thang = now.getMonth() + 1;
      const nam = now.getFullYear();

      for (const pc of phuCapList) {
        await conn.query(
          `
          INSERT INTO phu_cap_chi_tiet (
            nhan_vien_id, hop_dong_id, loai_id, thang, nam, so_tien
          ) VALUES (?, ?, ?, ?, ?, ?)
          `,
          [nhan_vien_id, newId, pc.loai_id, thang, nam, pc.so_tien]
        );
      }
    }

    // Cập nhật ngày vào làm
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

  const { role, isAccountingManager } = await getUserScope(req);

  if (role !== "admin") {
    const IS_KE_TOAN_MANAGER = !!isAccountingManager;

    if (!IS_KE_TOAN_MANAGER) {
      return { error: "Chỉ Admin hoặc Manager Phòng Kế Toán mới được sửa hợp đồng" };
    }

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
    phu_caps,
  } = req.body;

  let finalFile = old.file_hop_dong;
  if ((req as any).file) {
    finalFile = (req as any).file.path;
  }

  let final_ngay_ket_thuc = null;
  if (loai_hop_dong === "Xác định thời hạn") {
    final_ngay_ket_thuc = ngay_ket_thuc;
  }

  if (!nhan_vien_id || !loai_hop_dong || !ngay_bat_dau || luong_thoa_thuan == null) {
    return { error: "Vui lòng nhập đầy đủ thông tin bắt buộc" };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Cập nhật hợp đồng
    await conn.query(
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

    // Xóa phụ cấp cũ và thêm mới
    await conn.query(`DELETE FROM phu_cap_chi_tiet WHERE hop_dong_id = ?`, [id]);

    const phuCapList = parsePhuCaps(phu_caps);
    if (phuCapList.length > 0) {
      const now = new Date();
      const thang = now.getMonth() + 1;
      const nam = now.getFullYear();

      for (const pc of phuCapList) {
        await conn.query(
          `
          INSERT INTO phu_cap_chi_tiet (
            nhan_vien_id, hop_dong_id, loai_id, thang, nam, so_tien
          ) VALUES (?, ?, ?, ?, ?, ?)
          `,
          [nhan_vien_id, id, pc.loai_id, thang, nam, pc.so_tien]
        );
      }
    }

    await conn.commit();
    return { success: true };
  } catch (e) {
    await conn.rollback();
    console.error("Update hop_dong error:", e);
    return { error: "Lỗi hệ thống khi cập nhật hợp đồng" };
  } finally {
    conn.release();
  }
};

/* ==================== XOÁ ==================== */
export const remove = async (id: number, req: Request) => {
  if (!Number.isFinite(id) || id <= 0) return { success: false };

  const { role } = await getUserScope(req);

  if (role !== "admin") return { error: "Chỉ Admin mới có quyền xóa hợp đồng" };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(`DELETE FROM phu_cap_chi_tiet WHERE hop_dong_id = ?`, [id]);
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
