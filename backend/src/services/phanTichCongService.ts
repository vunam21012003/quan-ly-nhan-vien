//phanTichCongService.ts
import { pool } from "../db";
import { Request } from "express";

const toMinutes = (t: string | null): number => {
  if (!t) return 0;
  const [h = 0, m = 0] = String(t).split(":").map(Number);
  return h * 60 + m;
};

export async function capNhatPhanTichCong(nhan_vien_id: number, ngay_lam: string) {
  if (!nhan_vien_id || !ngay_lam) return;

  const thang = Number(ngay_lam.slice(5, 7));
  const nam = Number(ngay_lam.slice(0, 4));
  const ym = `${nam}-${String(thang).padStart(2, "0")}`;

  // 1. Query Data
  const [records]: any = await pool.query(
    `SELECT ngay_lam, gio_vao, gio_ra, trang_thai, ghi_chu
     FROM cham_cong
     WHERE nhan_vien_id = ? AND LEFT(ngay_lam,7) = ?
     ORDER BY ngay_lam ASC`,
    [nhan_vien_id, ym]
  );

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

  // 2. Map Data
  const holidayMap = new Map<string, string>();
  for (const h of holidays) {
    const start = new Date(String(h.ngay).slice(0, 10));
    const span = Number(h.so_ngay_nghi || 1);
    for (let i = 0; i < span; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const existed = holidayMap.get(key);
      if (!existed || existed === "lam_bu") holidayMap.set(key, h.loai);
    }
  }
  const lamBuSet = new Set<string>(lamBuRows.map((x: any) => String(x.ngay).slice(0, 10)));

  const grouped: Record<string, any[]> = {};
  for (const r of records) {
    const d = String(r.ngay_lam).slice(0, 10);
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(r);
  }

  // 3. Init Vars (Reset về 0 để fix lỗi xóa hết)
  let tong_gio = 0;
  let gio_tang_ca = 0;
  let so_ngay_cong = 0.0;
  let so_ngay_nghi_phep = 0.0;
  let so_ngay_nghi_khong_phep = 0.0;
  let so_ngay_nghi_huong_luong = 0;

  // 4. Loop Records
  for (const [day, list] of Object.entries(grouped)) {
    const dateObj = new Date(day);
    const isSunday = dateObj.getDay() === 0; // ⭐ CHỦ NHẬT
    const loaiLe = holidayMap.get(day);
    const isLamBu = lamBuSet.has(day);
    const rec = list[0];
    const note = (rec.ghi_chu || "").toLowerCase();
    const status = rec.trang_thai;

    // Calc Hours
    let totalMin = 0;
    for (const r of list) {
      const s = toMinutes(r.gio_vao);
      const e = toMinutes(r.gio_ra);
      if (e > s) totalMin += e - s;
    }
    if (list.length === 1 && toMinutes(list[0].gio_vao) < 720 && toMinutes(list[0].gio_ra) > 780)
      totalMin -= 60;
    const workedHours = +(totalMin / 60).toFixed(2);

    // --- A. ƯU TIÊN LỄ / TẾT ---
    if (loaiLe === "le" || loaiLe === "tet") {
      if (workedHours <= 0) so_ngay_nghi_huong_luong += 1;
      else {
        so_ngay_nghi_huong_luong += 1;
        gio_tang_ca += workedHours * 3.0;
        tong_gio += workedHours;
      }
      continue;
    }

    // --- B. ƯU TIÊN CHỦ NHẬT (Nếu không làm bù) ---
    if (isSunday && !isLamBu) {
      if (workedHours > 0) {
        // Đi làm CN -> OT x2, không tính công chuẩn
        gio_tang_ca += workedHours * 2.0;
        tong_gio += workedHours;
      }
      continue;
    }

    // --- C. NGHỈ PHÉP ---
    let isLeave = false;
    if (status === "nghi_phep" || (workedHours === 0 && note.includes("phép"))) {
      so_ngay_nghi_phep += 1.0;
      isLeave = true;
    } else if (status === "vang_khong_phep" || (workedHours === 0 && note.includes("vắng"))) {
      so_ngay_nghi_khong_phep += 1.0;
      isLeave = true;
    } else if (
      note.includes("(0.5)") ||
      (note.includes("phép") && (note.includes("sáng") || note.includes("chiều")))
    ) {
      so_ngay_nghi_phep += 0.5;
    }

    if (isLeave) continue;

    // --- D. ĐI LÀM NGÀY THƯỜNG ---
    if (workedHours > 0) {
      if (loaiLe === "cuoi_tuan" && !isLamBu) {
        // Nếu là Thứ 7 (tùy công ty có nghỉ T7 ko, code cũ bạn check 'cuoi_tuan' ở đây)
        gio_tang_ca += workedHours * 2.0;
        tong_gio += workedHours;
      } else {
        // ⭐ CÔNG CHUẨN: Tính theo tỷ lệ giờ làm
        let cong = workedHours / 8;
        if (cong > 1) cong = 1; // Max 1 công

        so_ngay_cong += cong;
        tong_gio += workedHours;

        if (workedHours > 8) gio_tang_ca += (workedHours - 8) * 1.5;
      }
    }
  }

  // 5. Add missing holidays (Lễ chưa chấm công)
  for (const [day, loai] of holidayMap.entries()) {
    if (!grouped[day] && !lamBuSet.has(day) && (loai === "le" || loai === "tet")) {
      so_ngay_nghi_huong_luong += 1;
    }
  }

  // 6. Save DB
  const [exist]: any = await pool.query(
    `SELECT id FROM phan_tich_cong WHERE nhan_vien_id=? AND thang=? AND nam=?`,
    [nhan_vien_id, thang, nam]
  );

  const sqlParams = [
    tong_gio,
    gio_tang_ca,
    so_ngay_cong,
    so_ngay_nghi_phep,
    so_ngay_nghi_khong_phep,
    so_ngay_nghi_huong_luong,
    nhan_vien_id,
    thang,
    nam,
  ];

  if (exist.length > 0) {
    await pool.query(
      `UPDATE phan_tich_cong SET tong_gio=?, gio_tang_ca=?, so_ngay_cong=?, so_ngay_nghi_phep=?, so_ngay_nghi_khong_phep=?, so_ngay_nghi_huong_luong=?, updated_at=NOW() WHERE nhan_vien_id=? AND thang=? AND nam=?`,
      sqlParams
    );
  } else {
    // Chỉ tạo mới nếu có dữ liệu > 0 để tránh rác DB
    if (
      tong_gio > 0 ||
      so_ngay_cong > 0 ||
      so_ngay_nghi_phep > 0 ||
      so_ngay_nghi_huong_luong > 0 ||
      so_ngay_nghi_khong_phep > 0
    ) {
      await pool.query(
        `INSERT INTO phan_tich_cong (nhan_vien_id, thang, nam, tong_gio, gio_tang_ca, so_ngay_cong, so_ngay_nghi_phep, so_ngay_nghi_khong_phep, so_ngay_nghi_huong_luong, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
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
  }
}

// ==================== GET LIST (GIỮ NGUYÊN) ====================
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
  return { employeeId: me?.employeeId ?? null, managedDepartmentIds, role: user.role };
}

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
    `SELECT pt.*, nv.ho_ten, pb.ten_phong_ban, cv.ten_chuc_vu
    FROM phan_tich_cong pt
    JOIN nhan_vien nv ON nv.id = pt.nhan_vien_id
    LEFT JOIN phong_ban pb ON nv.phong_ban_id = pb.id
    LEFT JOIN chuc_vu cv ON nv.chuc_vu_id = cv.id
    ${whereSql}
    ORDER BY pt.nam DESC, pt.thang DESC, pt.id DESC`,
    params
  );
  return rows;
};

// ==================== CREATE MANUAL (GIỮ NGUYÊN) ====================
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
  if (!nhan_vien_id || !thang || !nam) return { error: "nhan_vien_id, thang, nam là bắt buộc" };

  const [r]: any = await pool.query(
    `INSERT INTO phan_tich_cong (nhan_vien_id, thang, nam, tong_gio, gio_tang_ca, so_ngay_cong, so_ngay_nghi_phep, so_ngay_nghi_khong_phep, so_ngay_nghi_huong_luong, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
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
