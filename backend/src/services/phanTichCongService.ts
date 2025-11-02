// ===============================================
// src/services/phanTichCongService.ts
// ===============================================
import { Request } from "express";
import { pool } from "../db";

// ==================== HỖ TRỢ ====================

// "HH:mm" -> phút
const toMinutes = (t: string | null): number => {
  if (!t) return 0;
  const [h = 0, m = 0] = String(t).split(":").map(Number);
  return h * 60 + m;
};

// ==================== CHÍNH ====================

/**
 * Cập nhật tổng hợp bảng phan_tich_cong cho 1 NV trong 1 tháng (theo ngày_lam truyền vào)
 * - tong_gio: tổng giờ THỰC TẾ (không nhân hệ số)
 * - gio_tang_ca: tổng giờ LÀM THÊM sau khi nhân hệ số (x1.5, x2.0, x3.0)
 * - so_ngay_cong: công thực tế (8h = 1 công), chỉ cho ngày làm việc (thường/lam_bu)
 * - so_ngay_nghi_huong_luong: ngày nghỉ hưởng lương (Lễ/Tết, phép năm, việc riêng theo quy định)
 * - so_ngay_nghi_phep / so_ngay_nghi_khong_phep: theo trạng thái
 */
export async function capNhatPhanTichCong(nhan_vien_id: number, ngay_lam: string) {
  if (!nhan_vien_id || !ngay_lam) return;

  const thang = Number(ngay_lam.slice(5, 7));
  const nam = Number(ngay_lam.slice(0, 4));
  const ym = `${nam}-${String(thang).padStart(2, "0")}`;

  // 1) Lấy chấm công trong tháng (thêm ghi_chu để xác định nghỉ phép thực sự)
  const [records]: any = await pool.query(
    `SELECT ngay_lam, gio_vao, gio_ra, trang_thai, ghi_chu
     FROM cham_cong
     WHERE nhan_vien_id = ? AND LEFT(ngay_lam,7) = ?
     ORDER BY ngay_lam ASC`,
    [nhan_vien_id, ym]
  );

  // 2) Lấy danh sách ngày lễ/làm bù trong tháng (hỗ trợ Lễ nhiều ngày)
  //    Chúng ta lấy cả các ngày mà "điểm kết thúc" chuỗi lễ rơi trong tháng.
  const [holidays]: any = await pool.query(
    `SELECT ngay, loai, COALESCE(so_ngay_nghi,1) AS so_ngay_nghi
     FROM ngay_le
     WHERE (LEFT(ngay,7) = ? OR LEFT(DATE_ADD(ngay, INTERVAL COALESCE(so_ngay_nghi,1)-1 DAY),7) = ?)`,
    [ym, ym]
  );

  const [lamBuRows]: any = await pool.query(
    `SELECT ngay FROM phan_cong_lam_bu WHERE nhan_vien_id = ?`,
    [nhan_vien_id]
  );

  // Trải các chuỗi ngày lễ thành từng ngày đơn lẻ
  const holidayMap = new Map<string, string>(); // yyyy-mm-dd -> loai ('le'|'tet'|'cuoi_tuan'|'lam_bu')
  for (const h of holidays) {
    const start = new Date(String(h.ngay).slice(0, 10));
    const span = Number(h.so_ngay_nghi || 1);
    for (let i = 0; i < span; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      // ưu tiên 'le' | 'tet' nếu trùng; 'lam_bu' chỉ ghi đè khi chưa có gì
      const existed = holidayMap.get(key);
      if (!existed || existed === "lam_bu") {
        holidayMap.set(key, h.loai);
      }
    }
  }

  const lamBuSet = new Set<string>(lamBuRows.map((x: any) => String(x.ngay).slice(0, 10)));

  // 3) Gom chấm công theo ngày
  const grouped: Record<string, any[]> = {};
  for (const r of records) {
    const d = String(r.ngay_lam).slice(0, 10);
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(r);
  }

  // 4) Biến tổng
  let tong_gio = 0; // giờ thực tế, không nhân hệ số
  let gio_tang_ca = 0; // giờ làm thêm nhân hệ số
  let so_ngay_cong = 0;
  let so_ngay_nghi_phep = 0;
  let so_ngay_nghi_khong_phep = 0;
  let so_ngay_nghi_huong_luong = 0;

  // === 5) Duyệt từng ngày có chấm công ===
  for (const [day, list] of Object.entries(grouped)) {
    const loai = holidayMap.get(day);
    const isLamBu = lamBuSet.has(day);

    // Tính tổng giờ làm thực tế
    let totalMin = 0;
    for (const r of list) {
      const start = toMinutes(r.gio_vao);
      const end = toMinutes(r.gio_ra);
      if (end > start) totalMin += end - start;
    }
    if (list.length === 1 && toMinutes(list[0].gio_vao) < 720 && toMinutes(list[0].gio_ra) > 780)
      totalMin -= 60;

    const workedHours = +(totalMin / 60).toFixed(2);

    // === Xác định nghỉ phép / nghỉ không phép chuẩn xác ===
    const note = (list[0]?.ghi_chu || "").toLowerCase().trim();
    const trangThai = list[0]?.trang_thai || "";

    const isNghiPhep =
      trangThai === "nghi_phep" ||
      (!workedHours && (note.includes("nghỉ phép") || note.includes("nghi phep")));

    const isNghiKhongPhep =
      trangThai === "vang_khong_phep" ||
      (!workedHours && (note.includes("vắng") || note.includes("vang khong phep")));

    if (isNghiPhep) {
      so_ngay_nghi_phep += 1;
      continue;
    }

    if (isNghiKhongPhep) {
      so_ngay_nghi_khong_phep += 1;
      continue;
    }

    // --- Ngày Lễ / Tết ---
    if (loai === "le" || loai === "tet") {
      if (workedHours <= 0) {
        so_ngay_nghi_huong_luong += 1;
      } else {
        so_ngay_nghi_huong_luong += 1; // vẫn hưởng lương lễ
        gio_tang_ca += workedHours * 3.0;
        tong_gio += workedHours;
      }
      continue;
    }

    // --- Cuối tuần không làm bù ---
    if (loai === "cuoi_tuan" && !isLamBu) {
      if (workedHours > 0) {
        gio_tang_ca += workedHours * 2.0;
        tong_gio += workedHours;
      }
      continue;
    }

    // --- Làm bù / Ngày thường ---
    if (workedHours > 0) {
      // ✅ CÔNG CHUẨN: đi làm >=4h thì tính tròn 1 công, <4h thì tính theo giờ /8
      if (workedHours >= 4) {
        so_ngay_cong += 1;
      } else {
        so_ngay_cong += workedHours / 8;
      }

      // ✅ Tăng ca sau 8 tiếng làm việc
      const otHours = Math.max(0, workedHours - 8);
      if (otHours > 0) {
        gio_tang_ca += otHours * 1.5;
      }

      // ✅ Giờ thực tế (hiển thị trong phiếu lương)
      tong_gio += workedHours;
    }
  }

  // 6) Bổ sung: tự cộng ngày Lễ/Tết đã qua nhưng không có dòng chấm công
  for (const [day, loai] of holidayMap.entries()) {
    const isInChamCong = grouped[day] !== undefined;
    const isLamBu = lamBuSet.has(day);
    if (isInChamCong || isLamBu) continue; // đã xử lý ở trên

    if (loai === "le" || loai === "tet") {
      so_ngay_nghi_huong_luong += 1; // nghỉ hưởng lương tự động
    }
  }

  // 7) Ghi vào phan_tich_cong
  const [exist]: any = await pool.query(
    `SELECT id FROM phan_tich_cong WHERE nhan_vien_id=? AND thang=? AND nam=?`,
    [nhan_vien_id, thang, nam]
  );

  if (exist.length > 0) {
    await pool.query(
      `UPDATE phan_tich_cong
       SET tong_gio=?, gio_tang_ca=?, so_ngay_cong=?, 
           so_ngay_nghi_phep=?, so_ngay_nghi_khong_phep=?, so_ngay_nghi_huong_luong=?, updated_at=NOW()
       WHERE nhan_vien_id=? AND thang=? AND nam=?`,
      [
        tong_gio,
        gio_tang_ca,
        so_ngay_cong,
        so_ngay_nghi_phep,
        so_ngay_nghi_khong_phep,
        so_ngay_nghi_huong_luong,
        nhan_vien_id,
        thang,
        nam,
      ]
    );
  } else {
    await pool.query(
      `INSERT INTO phan_tich_cong
       (nhan_vien_id, thang, nam, tong_gio, gio_tang_ca, so_ngay_cong, 
        so_ngay_nghi_phep, so_ngay_nghi_khong_phep, so_ngay_nghi_huong_luong, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        nhan_vien_id,
        thang,
        nam,
        tong_gio,
        gio_tang_ca,
        so_ngay_cong,
        so_ngay_nghi_phep,
        so_ngay_nghi_khong_phep,
        so_ngay_nghi_huong_luong,
      ]
    );
  }

  console.log(
    `📊 [NV ${nhan_vien_id}] ${String(thang).padStart(2, "0")}/${nam}: ` +
      `Cong=${so_ngay_cong.toFixed(2)} | NghiHL=${so_ngay_nghi_huong_luong} | ` +
      `Phep=${so_ngay_nghi_phep} | KhongPhep=${so_ngay_nghi_khong_phep} | ` +
      `GioThuc=${tong_gio.toFixed(2)} | OT=${gio_tang_ca.toFixed(2)}`
  );
}

// ==================== PHÂN QUYỀN & LẤY DANH SÁCH ====================

async function getUserScope(req: Request) {
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

// ==================== LẤY DANH SÁCH PHÂN TÍCH CÔNG ====================

export const getAll = async (req: Request) => {
  const { employeeId, managedDepartmentIds, role } = await getUserScope(req);
  const thang = Number(req.query.thang);
  const nam = Number(req.query.nam);
  const nhan_vien_id = Number(req.query.nhan_vien_id);

  const where: string[] = [];
  const params: any[] = [];

  if (Number.isInteger(thang)) {
    where.push("pt.thang = ?");
    params.push(thang);
  }
  if (Number.isInteger(nam)) {
    where.push("pt.nam = ?");
    params.push(nam);
  }

  if (role === "manager") {
    if (!managedDepartmentIds.length) return [];
    where.push(`nv.phong_ban_id IN (${managedDepartmentIds.map(() => "?").join(",")})`);
    params.push(...managedDepartmentIds);
  } else if (role === "employee") {
    if (!employeeId) return [];
    where.push("pt.nhan_vien_id = ?");
    params.push(employeeId);
  } else if (Number.isInteger(nhan_vien_id)) {
    where.push("pt.nhan_vien_id = ?");
    params.push(nhan_vien_id);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `
    SELECT pt.*, nv.ho_ten, pb.ten_phong_ban, cv.ten_chuc_vu
    FROM phan_tich_cong pt
    JOIN nhan_vien nv ON nv.id = pt.nhan_vien_id
    LEFT JOIN phong_ban pb ON nv.phong_ban_id = pb.id
    LEFT JOIN chuc_vu cv ON nv.chuc_vu_id = cv.id
    ${whereSql}
    ORDER BY pt.nam DESC, pt.thang DESC, pt.id DESC
  `,
    params
  );

  return rows;
};

// ==================== TẠO MỚI BẢN GHI THỦ CÔNG ====================

export const create = async (req: Request) => {
  const {
    nhan_vien_id,
    thang,
    nam,
    tong_gio,
    gio_tang_ca,
    so_ngay_cong,
    so_ngay_nghi_phep,
    so_ngay_nghi_khong_phep,
    so_ngay_nghi_huong_luong,
  } = req.body || {};

  if (!nhan_vien_id || !thang || !nam) {
    return { error: "nhan_vien_id, thang, nam là bắt buộc" };
  }

  const [r]: any = await pool.query(
    `
    INSERT INTO phan_tich_cong
      (nhan_vien_id, thang, nam, tong_gio, gio_tang_ca, so_ngay_cong, 
       so_ngay_nghi_phep, so_ngay_nghi_khong_phep, so_ngay_nghi_huong_luong, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `,
    [
      nhan_vien_id,
      thang,
      nam,
      tong_gio || 0,
      gio_tang_ca || 0,
      so_ngay_cong || 0,
      so_ngay_nghi_phep || 0,
      so_ngay_nghi_khong_phep || 0,
      so_ngay_nghi_huong_luong || 0,
    ]
  );

  return { id: r.insertId };
};
