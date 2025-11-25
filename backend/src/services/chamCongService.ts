import { Request } from "express";
import { pool } from "../db";
import { findHoliday } from "./ngayLeService";
import { capNhatPhanTichCong } from "./phanTichCongService";
import { isLamBu } from "./phanCongLamBuService";

// ==================== LẤY PHẠM VI NGƯỜI DÙNG ====================
async function getUserScope(req: Request) {
  const user = (req as any).user;

  const [[me]]: any = await pool.query(
    "SELECT nhan_vien_id AS employeeId FROM tai_khoan WHERE id = ?",
    [user.id]
  );

  let managedDepartmentIds: number[] = [];
  let managedDepartmentNames: string[] = [];

  if (user.role === "manager") {
    const [rows]: any = await pool.query(
      "SELECT id, ten_phong_ban FROM phong_ban WHERE manager_taikhoan_id = ?",
      [user.id]
    );
    managedDepartmentIds = rows.map((r: any) => r.id);
    managedDepartmentNames = rows.map((r: any) => String(r.ten_phong_ban || ""));
  }

  return {
    employeeId: me?.employeeId ?? null,
    managedDepartmentIds,
    managedDepartmentNames,
    role: user.role as "admin" | "manager" | "employee",
  };
}

// ==================== HÀM HỖ TRỢ ====================
const toMinutes = (t: string): number => {
  if (!t) return 0;
  const [h = 0, m = 0] = t.split(":").map(Number);
  return h * 60 + m;
};

// ==================== HÀM TÍNH CHẤM CÔNG ====================
export async function evaluateChamCong(
  nhan_vien_id: number,
  ngay_lam: string,
  gio_vao_excel?: string | null,
  gio_ra_excel?: string | null,
  ghi_chu_excel?: string
) {
  // 🔧 Chuẩn hóa định dạng ngày (tránh lệch timezone)
  const ngaySql = String(ngay_lam).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngaySql)) throw new Error("Ngày làm không hợp lệ");

  // --- Các hàm hỗ trợ ---
  const toMinutes = (t?: string): number => {
    if (!t) return NaN;
    const [h = 0, m = 0] = String(t).split(":").map(Number);
    return h * 60 + m;
  };

  const GIO_VAO = 8 * 60;
  const GIO_RA = 17 * 60;

  // --- Truy vấn các thông tin cần thiết ---
  const holiday = await findHoliday(ngaySql);
  const lamBu = await isLamBu(nhan_vien_id, ngaySql);

  // --- Kiểm tra ghi chú và giờ làm ---
  const note = (ghi_chu_excel || "").toLowerCase().trim();
  const hasInOut = !!(gio_vao_excel && gio_ra_excel);

  let trang_thai = "di_lam";
  let ghi_chu = "";
  let gio_tang_ca = 0;
  let tong_gio = 0;
  const pieces: string[] = [];

  // ========================================================
  // 1️⃣ TRƯỜNG HỢP KHÔNG CÓ GIỜ VÀO/RA
  // ========================================================
  if (!hasInOut) {
    if (note.includes("phép") || note.includes("phep")) {
      return {
        trang_thai: "nghi_phep",
        ghi_chu: "Nghỉ phép (cả ngày)",
        tong_gio: 0,
        gio_tang_ca: 0,
      };
    } else if (!note) {
      return {
        trang_thai: "vang_khong_phep",
        ghi_chu: "Vắng không phép",
        tong_gio: 0,
        gio_tang_ca: 0,
      };
    } else {
      return {
        trang_thai: "ghi_chu_khac",
        ghi_chu: ghi_chu_excel || "",
        tong_gio: 0,
        gio_tang_ca: 0,
      };
    }
  }

  // ========================================================
  // 2️⃣ TRƯỜNG HỢP CÓ GIỜ VÀO/RA → TÍNH GIỜ LÀM
  // ========================================================
  const [records]: any = await pool.query(
    `SELECT gio_vao, gio_ra 
     FROM cham_cong 
     WHERE nhan_vien_id = ? AND ngay_lam = ?
     ORDER BY gio_vao ASC`,
    [nhan_vien_id, ngaySql]
  );

  let totalMinutes = 0;
  if (records.length > 0) {
    for (const r of records) {
      const sv = toMinutes(r.gio_vao);
      const ev = toMinutes(r.gio_ra);
      if (!Number.isNaN(sv) && !Number.isNaN(ev) && ev > sv) {
        totalMinutes += ev - sv;
      }
    }
    const firstIn = toMinutes(records[0]?.gio_vao);
    const lastOut = toMinutes(records.at(-1)?.gio_ra);
    const coversLunch = records.length === 1 && firstIn < 12 * 60 && lastOut > 13 * 60;
    if (coversLunch) totalMinutes -= 60;
  } else {
    const sv = toMinutes(gio_vao_excel);
    const ev = toMinutes(gio_ra_excel);
    if (!Number.isNaN(sv) && !Number.isNaN(ev) && ev > sv) {
      totalMinutes = ev - sv;
      if (sv < 12 * 60 && ev > 13 * 60) totalMinutes -= 60;
    }
  }

  tong_gio = Math.max(0, totalMinutes / 60);

  // ========================================================
  // 3️⃣ NGÀY LỄ / LÀM BÙ / NGÀY ĐẶC BIỆT
  // ========================================================
  const isLamBuDay = holiday?.loai === "lam_bu" || (holiday?.loai === "cuoi_tuan" && lamBu);
  if (holiday && !isLamBuDay) {
    if (holiday.loai === "le") {
      pieces.push("Ngày lễ");
      if (tong_gio > 0) gio_tang_ca = tong_gio * 3.0;
    } else if (holiday.loai === "tet") {
      pieces.push("Ngày Tết");
      if (tong_gio > 0) gio_tang_ca = tong_gio * 3.0;
    } else if (holiday.loai === "cuoi_tuan") {
      pieces.push("Làm ngày nghỉ (cuối tuần)");
      if (tong_gio > 0) gio_tang_ca = tong_gio * 2.0;
    }
    ghi_chu = pieces.join(", ");
    return { trang_thai, ghi_chu, tong_gio, gio_tang_ca };
  }

  if (isLamBuDay) {
    pieces.push("Làm bù (ngày nghỉ)");
  }

  // ========================================================
  // 4️⃣ ĐI MUỘN / VỀ SỚM (chỉ khi có giờ vào ra hợp lệ)
  // ========================================================
  const vao = toMinutes(gio_vao_excel || records[0]?.gio_vao);
  const ra = toMinutes(gio_ra_excel || records.at(-1)?.gio_ra);
  const hasValidInOut = !Number.isNaN(vao) && !Number.isNaN(ra) && vao >= 0 && ra >= 0;

  if (hasValidInOut) {
    const late = vao - GIO_VAO;
    const delta = ra - GIO_RA;

    if (late > 0) {
      if (late <= 10) pieces.push("Đi muộn ≤10p");
      else if (late <= 30) pieces.push("Đi muộn ≤30p");
      else if (late <= 60) pieces.push("Đi muộn ≤60p");
      else {
        pieces.push("Đi muộn >60p");
        trang_thai = "di_muon";
      }
    }

    if (delta < 0) {
      const early = -delta;
      if (early <= 10) pieces.push("Về sớm ≤10p");
      else if (early <= 30) pieces.push("Về sớm ≤30p");
      else if (early <= 60) pieces.push("Về sớm ≤60p");
      else {
        pieces.push("Về sớm >60p");
        trang_thai = "ve_som";
      }
    }
  }

  // ========================================================
  // 5️⃣ TĂNG CA (sau 8 tiếng)
  // ========================================================
  if (tong_gio > 8) {
    const ot = tong_gio - 8;
    gio_tang_ca = ot * (isLamBuDay ? 1.0 : 1.5);
    pieces.push(`Tăng ca ${ot.toFixed(2)}h (x${isLamBuDay ? "1.0" : "1.5"})`);
  }

  // ========================================================
  // 6️⃣ GHI CHÚ & TRẠNG THÁI CUỐI
  // ========================================================
  if (note.includes("phép") || note.includes("phep")) {
    pieces.push("Có phép trong ngày");
  }

  ghi_chu = pieces.length ? pieces.join(", ") : "Bình thường";

  return { trang_thai, ghi_chu, tong_gio, gio_tang_ca };
}

// ==================== TẠO MỚI ====================
export const createChamCong = async (req: Request) => {
  const { nhan_vien_id, ngay_lam, gio_vao, gio_ra, ghi_chu } = req.body || {};
  if (!nhan_vien_id || !ngay_lam) {
    return { error: "Thiếu nhân viên hoặc ngày", status: 400 };
  }

  const scope = await getUserScope(req);

  // ---- PHÂN QUYỀN ----
  const isAdmin = scope.role === "admin";
  const isManager = scope.role === "manager";
  const isKeToanManager =
    isManager && scope.managedDepartmentNames.some((n) => n.toLowerCase().includes("kế toán"));

  // Nhân viên: chỉ được xem, không tạo
  if (scope.role === "employee") {
    return { error: "Bạn không có quyền thêm chấm công", status: 403 };
  }

  // Manager thường: chỉ tạo cho nhân viên thuộc phòng ban mình
  if (isManager && !isKeToanManager) {
    const [[nv]]: any = await pool.query("SELECT phong_ban_id FROM nhan_vien WHERE id = ?", [
      nhan_vien_id,
    ]);
    if (!nv) {
      return { error: "Không tìm thấy nhân viên", status: 404 };
    }
    if (!scope.managedDepartmentIds.includes(nv.phong_ban_id)) {
      return {
        error: "Bạn chỉ được chấm công cho nhân viên phòng ban mình",
        status: 403,
      };
    }
  }
  // Admin & Manager kế toán: full quyền (không giới hạn phòng ban)

  // ======== ⛔ CHẶN CHẤM CÔNG KHI LƯƠNG ĐÃ DUYỆT ========
  const thang = Number(String(ngay_lam).slice(5, 7));
  const nam = Number(String(ngay_lam).slice(0, 4));

  const [[luongState]]: any = await pool.query(
    `
    SELECT trang_thai_duyet
    FROM luong
    WHERE nhan_vien_id = ? AND thang = ? AND nam = ?
    LIMIT 1
    `,
    [nhan_vien_id, thang, nam]
  );

  if (luongState?.trang_thai_duyet === "da_duyet") {
    return {
      error: `Kỳ lương ${thang}/${nam} đã duyệt — không thể chấm công.`,
      status: 400,
    };
  }
  // =====================================================

  const result = await evaluateChamCong(
    Number(nhan_vien_id),
    String(ngay_lam),
    gio_vao,
    gio_ra,
    ghi_chu
  );

  const [r]: any = await pool.query(
    `INSERT INTO cham_cong 
       (nhan_vien_id, ngay_lam, gio_vao, gio_ra, ghi_chu, trang_thai, tong_gio)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      nhan_vien_id,
      ngay_lam,
      gio_vao || null,
      gio_ra || null,
      result.ghi_chu,
      result.trang_thai,
      result.tong_gio,
    ]
  );

  await capNhatPhanTichCong(Number(nhan_vien_id), String(ngay_lam));
  return { data: { id: r.insertId } };
};

// ==================== CẬP NHẬT CHẤM CÔNG ====================
export const updateChamCong = async (req: Request) => {
  const id = Number(req.params.id);
  const { gio_vao, gio_ra, ghi_chu } = req.body || {};

  if (!Number.isFinite(id) || id <= 0) {
    return { error: "ID không hợp lệ", status: 400 };
  }

  const scope = await getUserScope(req);
  const isAdmin = scope.role === "admin";
  const isManager = scope.role === "manager";
  const isKeToanManager =
    isManager && scope.managedDepartmentNames.some((n) => n.toLowerCase().includes("kế toán"));

  // Lấy bản ghi cũ (kèm phòng ban)
  const [[oldRow]]: any = await pool.query(
    `SELECT 
        cc.nhan_vien_id,
        cc.ngay_lam,
        nv.phong_ban_id
     FROM cham_cong cc
     JOIN nhan_vien nv ON nv.id = cc.nhan_vien_id
     WHERE cc.id = ?`,
    [id]
  );
  if (!oldRow) {
    return { error: "Không tìm thấy bản ghi", status: 404 };
  }

  // ---- PHÂN QUYỀN ----
  if (scope.role === "employee") {
    return { error: "Bạn không có quyền sửa chấm công", status: 403 };
  }

  if (isManager && !isKeToanManager) {
    if (!scope.managedDepartmentIds.includes(oldRow.phong_ban_id)) {
      return {
        error: "Bạn chỉ được sửa chấm công của nhân viên phòng ban mình",
        status: 403,
      };
    }
  }
  // Admin & Manager kế toán: full quyền

  // ======== ⛔ CHẶN SỬA CHẤM CÔNG KHI LƯƠNG ĐÃ DUYỆT ========
  const thang = Number(String(oldRow.ngay_lam).slice(5, 7));
  const nam = Number(String(oldRow.ngay_lam).slice(0, 4));

  const [[luongState]]: any = await pool.query(
    `
    SELECT trang_thai_duyet
    FROM luong
    WHERE nhan_vien_id = ? AND thang = ? AND nam = ?
    LIMIT 1
    `,
    [oldRow.nhan_vien_id, thang, nam]
  );

  if (luongState?.trang_thai_duyet === "da_duyet") {
    return {
      error: `Kỳ lương ${thang}/${nam} đã duyệt — không thể sửa chấm công.`,
      status: 400,
    };
  }
  // ===============================================================

  const result = await evaluateChamCong(
    Number(oldRow.nhan_vien_id),
    String(oldRow.ngay_lam),
    gio_vao,
    gio_ra,
    ghi_chu
  );

  const [r]: any = await pool.query(
    `UPDATE cham_cong
       SET gio_vao = ?, 
           gio_ra = ?, 
           ghi_chu = ?, 
           trang_thai = ?, 
           tong_gio = ?
     WHERE id = ?`,
    [gio_vao || null, gio_ra || null, result.ghi_chu, result.trang_thai, result.tong_gio, id]
  );

  await capNhatPhanTichCong(Number(oldRow.nhan_vien_id), String(oldRow.ngay_lam));
  return r.affectedRows > 0;
};

// ==================== LẤY DANH SÁCH ====================
export const getList = async (req: Request) => {
  const scope = await getUserScope(req);
  const { page = 1, limit = 10 } = req.query as any;
  const offset = (Number(page) - 1) * Number(limit);

  const where: string[] = [];
  const params: any[] = [];

  const { nhan_vien_id, ten_nhan_vien, from, to, phong_ban_id, trang_thai } = req.query as any;

  // ==== GIỮ NGUYÊN TOÀN BỘ LOGIC CŨ ====
  if (nhan_vien_id) {
    where.push("cc.nhan_vien_id = ?");
    params.push(nhan_vien_id);
  }

  if (ten_nhan_vien) {
    where.push("nv.ho_ten LIKE ?");
    params.push(`%${ten_nhan_vien}%`);
  }

  if (from) {
    where.push("cc.ngay_lam >= ?");
    params.push(from);
  }

  if (to) {
    where.push("cc.ngay_lam <= ?");
    params.push(to);
  }

  if (phong_ban_id) {
    where.push("nv.phong_ban_id = ?");
    params.push(phong_ban_id);
  }

  if (trang_thai) {
    where.push("cc.trang_thai = ?");
    params.push(trang_thai);
  }

  // ============================================================
  // ⭐⭐ THÊM PHÂN QUYỀN (KHÔNG SỬA GÌ LOGIC CŨ CỦA BẠN)
  // ============================================================

  const isKeToan =
    scope.role === "manager" &&
    scope.managedDepartmentNames.some((n: string) => n.toLowerCase().includes("kế toán"));

  if (scope.role === "employee") {
    where.push("cc.nhan_vien_id = ?");
    params.push(scope.employeeId);
  }

  if (scope.role === "manager" && !isKeToan) {
    if (scope.managedDepartmentIds.length > 0) {
      where.push(`nv.phong_ban_id IN (${scope.managedDepartmentIds.map(() => "?").join(",")})`);
      params.push(...scope.managedDepartmentIds);
    }
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // Đếm tổng
  const [[{ total }]]: any = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM cham_cong cc
    JOIN nhan_vien nv ON cc.nhan_vien_id = nv.id
    ${whereSql}
    `,
    params
  );

  // Lấy danh sách
  const [rows]: any = await pool.query(
    `
    SELECT
      cc.id,
      DATE_FORMAT(cc.ngay_lam, '%Y-%m-%d') AS ngay_lam,
      cc.nhan_vien_id,
      cc.gio_vao,
      cc.gio_ra,
      cc.ghi_chu,
      cc.trang_thai,
      cc.tong_gio,
      nv.ho_ten,
      pb.ten_phong_ban AS phong_ban,
      cv.ten_chuc_vu AS chuc_vu
    FROM cham_cong cc
    JOIN nhan_vien nv ON cc.nhan_vien_id = nv.id
    LEFT JOIN phong_ban pb ON nv.phong_ban_id = pb.id
    LEFT JOIN chuc_vu cv ON nv.chuc_vu_id = cv.id
    ${whereSql}
    ORDER BY cc.ngay_lam DESC, nv.ho_ten ASC
    LIMIT ? OFFSET ?
    `,
    [...params, Number(limit), offset]
  );

  return { items: rows, total, page: Number(page), limit: Number(limit) };
};

// ==================== XOÁ CHẤM CÔNG ====================
export const deleteChamCong = async (req: Request) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return { error: "ID không hợp lệ", status: 400 };
  }

  const scope = await getUserScope(req);
  const isAdmin = scope.role === "admin";
  const isManager = scope.role === "manager";
  const isKeToanManager =
    isManager && scope.managedDepartmentNames.some((n) => n.toLowerCase().includes("kế toán"));

  // Lấy bản ghi + phòng ban
  const [[row]]: any = await pool.query(
    `SELECT 
        cc.nhan_vien_id,
        cc.ngay_lam,
        nv.phong_ban_id
     FROM cham_cong cc
     JOIN nhan_vien nv ON nv.id = cc.nhan_vien_id
     WHERE cc.id = ?`,
    [id]
  );
  if (!row) {
    return { error: "Không tìm thấy bản ghi", status: 404 };
  }

  // ---- PHÂN QUYỀN ----
  if (scope.role === "employee") {
    return { error: "Bạn không có quyền xoá chấm công", status: 403 };
  }

  if (isManager && !isKeToanManager) {
    if (!scope.managedDepartmentIds.includes(row.phong_ban_id)) {
      return {
        error: "Bạn chỉ được xoá chấm công của nhân viên phòng ban mình",
        status: 403,
      };
    }
  }
  // Admin & Manager kế toán: full quyền

  // ======== ⛔ CHẶN XOÁ KHI LƯƠNG ĐÃ DUYỆT ========
  const thang = Number(String(row.ngay_lam).slice(5, 7));
  const nam = Number(String(row.ngay_lam).slice(0, 4));

  const [[luongState]]: any = await pool.query(
    `
    SELECT trang_thai_duyet
    FROM luong
    WHERE nhan_vien_id = ? AND thang = ? AND nam = ?
    LIMIT 1
    `,
    [row.nhan_vien_id, thang, nam]
  );

  if (luongState?.trang_thai_duyet === "da_duyet") {
    return {
      error: `Kỳ lương ${thang}/${nam} đã duyệt — không thể xoá chấm công.`,
      status: 400,
    };
  }
  // ===============================================================

  await pool.query("DELETE FROM cham_cong WHERE id = ?", [id]);
  await capNhatPhanTichCong(Number(row.nhan_vien_id), String(row.ngay_lam));

  return { message: "Đã xoá chấm công" };
};
