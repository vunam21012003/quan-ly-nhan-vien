// src/services/phuCapThangService.ts
import { pool } from "../db";
import { isSalaryLocked } from "../utils/checkPaid";
import { layPhamViNguoiDung } from "../utils/pham-vi-nguoi-dung";

/* ============================================
   LẤY DANH SÁCH PHỤ CẤP
============================================ */
export const list = async (query: any) => {
  const {
    __phamvi, // ⭐ ĐÃ NHẬN TỪ CONTROLLER
    thang: qThang,
    nam: qNam,
    nhan_vien_id: qNv,
    mode: qMode,
  } = query;

  const thang = Number(qThang);
  const nam = Number(qNam);
  const nv = Number(qNv);
  const mode = qMode || "normal";

  let where = `WHERE 1=1`;
  const params: any[] = [];

  /* ============================================================
       ⭐⭐  PHÂN QUYỀN XEM DANH SÁCH  ⭐⭐
     ============================================================ */
  if (__phamvi) {
    const role = __phamvi.role;
    const employeeId = __phamvi.employeeId ?? __phamvi.employee_id; // <-- thêm dòng này
    const managedDepartmentIds = __phamvi.managedDepartmentIds || [];
    const isAccountingManager = __phamvi.isAccountingManager === true;

    // 🔥 Employee → chỉ xem chính mình
    if (role === "employee") {
      where += " AND pct.nhan_vien_id = ?";
      params.push(employeeId);
    }

    // 🔥 Manager thường → chỉ xem nhân viên thuộc phòng ban mình quản lý
    else if (role === "manager" && !isAccountingManager) {
      if (managedDepartmentIds.length > 0) {
        const placeholders = managedDepartmentIds.map(() => "?").join(",");
        where += ` AND nv.phong_ban_id IN (${placeholders})`;
        params.push(...managedDepartmentIds);
      } else {
        // ❌ Manager không quản lý phòng ban nào → không được thấy ai
        where += " AND 1=0";
      }
    }

    // 🔥 Manager kế toán → xem tất cả
    // Không giới hạn

    // 🔥 Admin → xem tất cả
  }

  /* ============================================================
       ⭐⭐  LỌC THEO NHÂN VIÊN (NẾU USER CHỌN)
     ============================================================ */
  if (!isNaN(nv) && nv) {
    where += " AND pct.nhan_vien_id = ?";
    params.push(nv);
  }

  /* ============================================================
       ⭐⭐  MODE NORMAL / ALL
     ============================================================ */
  if (mode === "normal") {
    if (!isNaN(thang) && thang) {
      where += " AND pct.thang = ?";
      params.push(thang);
    }
    if (!isNaN(nam) && nam) {
      where += " AND pct.nam = ?";
      params.push(nam);
    }
  } else if (mode === "all") {
    // Lấy: cố định + đúng tháng/năm
    where += " AND ( pc.is_fixed = 1 ";

    if (!isNaN(thang) && thang && !isNaN(nam) && nam) {
      where += " OR (pc.is_fixed = 0 AND pct.thang = ? AND pct.nam = ?) ";
      params.push(thang, nam);
    }

    where += ")";
  }

  /* ============================================================
       ⭐⭐  QUERY CUỐI CÙNG
     ============================================================ */
  const [rows] = await pool.query(
    `
      SELECT 
        pct.*, 
        nv.ho_ten,
        nv.phong_ban_id,
        pc.ten AS ten_phu_cap,
        pc.is_fixed
      FROM phu_cap_chi_tiet pct
      JOIN nhan_vien nv ON nv.id = pct.nhan_vien_id
      JOIN phu_cap_loai pc ON pc.id = pct.loai_id
      ${where}
      ORDER BY pc.is_fixed DESC, pct.id DESC
    `,
    params
  );

  return { data: rows };
};

/* ============================================
   THÊM PHỤ CẤP (HỖ TRỢ CHỌN NHIỀU)
============================================ */
export const create = async (body: any, req: any) => {
  // ===== PHÂN QUYỀN =====
  const phamvi = await layPhamViNguoiDung(req);

  // Employee: không thêm
  if (phamvi.role === "employee") {
    return { error: "Bạn không có quyền thêm phụ cấp!" };
  }

  const { nhan_vien_id } = body;

  // Lấy phòng ban của nhân viên được thêm
  const [[nv]]: any = await pool.query("SELECT phong_ban_id FROM nhan_vien WHERE id=?", [
    nhan_vien_id,
  ]);

  if (!nv) {
    return { error: "Nhân viên không tồn tại!" };
  }

  // Manager thường → chỉ thêm cho phòng ban họ quản lý
  if (phamvi.role === "manager" && !phamvi.isAccountingManager) {
    if (!phamvi.managedDepartmentIds.includes(nv.phong_ban_id)) {
      return { error: "Bạn không có quyền thêm phụ cấp cho phòng ban khác!" };
    }
  }

  // Manager kế toán → chỉ thêm cho phòng ban họ quản lý
  if (phamvi.role === "manager" && phamvi.isAccountingManager) {
    if (!phamvi.managedDepartmentIds.includes(nv.phong_ban_id)) {
      return { error: "Bạn chỉ có thể thêm phụ cấp cho phòng ban mình quản lý!" };
    }
  }

  // Admin: full quyền → không chặn gì

  // ===== TOÀN BỘ LOGIC CŨ GIỮ NGUYÊN TỪ ĐÂY =====
  const { loai_ids, thang, nam, so_tien_map, ghi_chu_map } = body;

  if (thang && nam && (await isSalaryLocked(nhan_vien_id, thang, nam))) {
    return { error: "Tháng này đã trả lương — không thể thêm phụ cấp!" };
  }

  if (!nhan_vien_id || !Array.isArray(loai_ids) || loai_ids.length === 0) {
    return { error: "Phải chọn ít nhất 1 phụ cấp!" };
  }

  const [[latestHopDong]]: any = await pool.query(
    "SELECT id FROM hop_dong WHERE nhan_vien_id = ? AND trang_thai = 'con_hieu_luc' ORDER BY ngay_ky DESC LIMIT 1",
    [nhan_vien_id]
  );
  const effectiveHopDongId = latestHopDong ? latestHopDong.id : null;

  const placeholders = loai_ids.map(() => "?").join(",");
  const [loais]: any = await pool.query(
    `SELECT id, is_fixed FROM phu_cap_loai WHERE id IN (${placeholders})`,
    loai_ids
  );

  for (const loai of loais) {
    if (loai.is_fixed == 1 && !effectiveHopDongId) {
      return { error: "Phụ cấp cố định cần hợp đồng còn hiệu lực!" };
    }
    if (loai.is_fixed == 0 && (!thang || !nam)) {
      return { error: "Phụ cấp theo tháng cần tháng & năm!" };
    }
  }

  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    const insertPromises = loais.map((loai: any) => {
      const th = loai.is_fixed ? null : thang;
      const n = loai.is_fixed ? null : nam;
      const hd = loai.is_fixed ? effectiveHopDongId : null;

      const tien = so_tien_map?.[loai.id] ?? 0;
      const note = ghi_chu_map?.[loai.id] ?? "";

      return connection.query(
        `
          INSERT INTO phu_cap_chi_tiet
          (nhan_vien_id, hop_dong_id, loai_id, thang, nam, so_tien, ghi_chu)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [nhan_vien_id, hd, loai.id, th, n, tien, note]
      );
    });

    const resultsArray = await Promise.all(insertPromises);
    const ids = resultsArray.map((r: any) => r[0].insertId);

    await connection.commit();
    connection.release();

    return { ids, count: ids.length };
  } catch (error) {
    await connection.rollback();
    connection.release();
    throw new Error(error instanceof Error ? error.message : "Lỗi SQL không rõ.");
  }
};

/* ============================================
   CẬP NHẬT PHỤ CẤP
============================================ */
export const update = async (id: number, body: any, req: any) => {
  // ===== PHÂN QUYỀN =====
  const phamvi = await layPhamViNguoiDung(req);

  // Manager thường không được sửa
  if (phamvi.role === "manager" && !phamvi.isAccountingManager) {
    return { error: "Manager thường không có quyền sửa phụ cấp!" };
  }

  // Employee không được sửa
  if (phamvi.role === "employee") {
    return { error: "Bạn không có quyền sửa phụ cấp!" };
  }

  // ===== GIỮ LOGIC CŨ NGUYÊN VẸN =====

  const { nhan_vien_id, loai_id, thang, nam, so_tien, ghi_chu } = body;

  if (loai_id && thang && nam && (await isSalaryLocked(nhan_vien_id, thang, nam))) {
    return { error: "Tháng này đã trả lương — không thể sửa phụ cấp!" };
  }

  const [[loai]]: any = await pool.query("SELECT is_fixed FROM phu_cap_loai WHERE id = ?", [
    loai_id,
  ]);

  if (!loai) return { error: "Loại phụ cấp không tồn tại!" };

  let th = null,
    n = null,
    hd = null;

  if (loai.is_fixed == 1) {
    const [[latestHopDong]]: any = await pool.query(
      "SELECT id FROM hop_dong WHERE nhan_vien_id = ? AND trang_thai='con_hieu_luc' ORDER BY ngay_ky DESC LIMIT 1",
      [nhan_vien_id]
    );

    const effectiveHopDongId = latestHopDong ? latestHopDong.id : null;
    if (!effectiveHopDongId) {
      return { error: "Phụ cấp cố định cần hợp đồng còn hiệu lực!" };
    }
    hd = effectiveHopDongId;
  } else {
    if (!thang || !nam) return { error: "Phụ cấp theo tháng cần tháng & năm!" };
    th = thang;
    n = nam;
  }

  await pool.query(
    `
      UPDATE phu_cap_chi_tiet
      SET nhan_vien_id=?, hop_dong_id=?, loai_id=?, thang=?, nam=?, so_tien=?, ghi_chu=?
      WHERE id=?
    `,
    [nhan_vien_id, hd, loai_id, th, n, so_tien, ghi_chu, id]
  );

  return { ok: true };
};

/* ============================================
   XÓA
============================================ */
export const remove = async (id: number, req: any) => {
  // ===== PHÂN QUYỀN =====
  const phamvi = await layPhamViNguoiDung(req);

  // Manager thường không được xóa
  if (phamvi.role === "manager" && !phamvi.isAccountingManager) {
    return { error: "Manager thường không có quyền xóa phụ cấp!" };
  }

  // Employee không được xóa
  if (phamvi.role === "employee") {
    return { error: "Bạn không có quyền xóa phụ cấp!" };
  }

  // ===== GIỮ LOGIC CŨ NGUYÊN VẸN =====

  const [[row]]: any = await pool.query(
    "SELECT nhan_vien_id, thang, nam FROM phu_cap_chi_tiet WHERE id=?",
    [id]
  );

  if (row?.thang && row?.nam) {
    if (await isSalaryLocked(row.nhan_vien_id, row.thang, row.nam)) {
      return { error: "Tháng này đã trả lương — không thể xóa phụ cấp!" };
    }
  }

  await pool.query("DELETE FROM phu_cap_chi_tiet WHERE id=?", [id]);
  return { ok: true };
};

// /* ============================================
//    AUTO COPY TỪ THÁNG TRƯỚC —— (ĐÃ FIX CHUẨN)
// ============================================ */
// export const autoCopyFromLastMonth = async (thang: number, nam: number) => {
//   if (!thang || !nam) {
//     return { ok: false, error: "Cần tháng và năm!", copiedCount: 0 };
//   }

//   // Tính tháng trước
//   let thangTruoc = thang - 1;
//   let namTruoc = nam;
//   if (thangTruoc < 1) {
//     thangTruoc = 12;
//     namTruoc -= 1;
//   }

//   // Lấy phụ cấp theo tháng của tháng trước
//   const [prevRecords]: any = await pool.query(
//     `
//       SELECT pct.*, pc.is_fixed
//       FROM phu_cap_chi_tiet pct
//       JOIN phu_cap_loai pc ON pc.id = pct.loai_id
//       WHERE pct.thang = ? AND pct.nam = ? AND pc.is_fixed = 0
//     `,
//     [thangTruoc, namTruoc]
//   );

//   if (!prevRecords || prevRecords.length === 0) {
//     return {
//       ok: false,
//       error: `Không có phụ cấp theo tháng ở ${thangTruoc}/${namTruoc}!`,
//       copiedCount: 0,
//     };
//   }

//   let copiedCount = 0;

//   for (const r of prevRecords) {
//     // Kiểm tra xem record (nhan_vien_id + loai_id) đã tồn tại trong tháng hiện tại chưa
//     const [exists]: any = await pool.query(
//       `
//         SELECT id FROM phu_cap_chi_tiet
//         WHERE nhan_vien_id = ? AND loai_id = ? AND thang = ? AND nam = ?
//         LIMIT 1
//       `,
//       [r.nhan_vien_id, r.loai_id, thang, nam]
//     );

//     if (exists.length > 0) {
//       // Bỏ qua nếu đã có
//       continue;
//     }

//     // Sao chép bản ghi chưa tồn tại
//     await pool.query(
//       `
//         INSERT INTO phu_cap_chi_tiet
//         (nhan_vien_id, hop_dong_id, loai_id, thang, nam, so_tien, ghi_chu)
//         VALUES (?, ?, ?, ?, ?, ?, ?)
//       `,
//       [r.nhan_vien_id, r.hop_dong_id, r.loai_id, thang, nam, r.so_tien, r.ghi_chu]
//     );

//     copiedCount++;
//   }

//   return {
//     ok: true,
//     copiedCount,
//     from: `${thangTruoc}/${namTruoc}`,
//     to: `${thang}/${nam}`,
//   };
// };
