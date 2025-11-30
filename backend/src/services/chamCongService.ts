//chamCongService.ts
import { Request } from "express";
import { pool } from "../db";
import { findHoliday } from "./ngayLeService";
import { capNhatPhanTichCong } from "./phanTichCongService";
import { isLamBu } from "./phanCongLamBuService";

// ==================== LẤY PHẠM VI NGƯỜI DÙNG (GIỮ NGUYÊN) ====================
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

function hasInOut(v: any, r: any, recs: any) {
  return (v && r) || (recs && recs.length > 0);
}

// ==================== KIỂM TRA ĐƠN NGHỈ PHÉP ====================
async function checkApprovedLeave(nhan_vien_id: number, ngay_lam: string) {
  const [rows]: any = await pool.query(
    `SELECT * FROM don_nghi_phep 
     WHERE nhan_vien_id = ? 
       AND trang_thai = 'da_duyet'
       AND ? BETWEEN ngay_bat_dau AND ngay_ket_thuc
     LIMIT 1`,
    [nhan_vien_id, ngay_lam]
  );
  return rows[0] || null;
}

// ==================================================================
// 🔥 HÀM TÍNH CHẤM CÔNG (LOGIC ĐÃ ĐƯỢC SỬA CHUẨN)
// ==================================================================
export async function evaluateChamCong(
  nhan_vien_id: number,
  ngay_lam: string,
  gio_vao_excel?: string | null,
  gio_ra_excel?: string | null,
  ghi_chu_excel?: string
) {
  const ngaySql = String(ngay_lam).slice(0, 10);

  // 1. MỐC GIỜ CHUẨN MẶC ĐỊNH
  let targetIn = 8 * 60; // 08:00
  let targetOut = 17 * 60; // 17:00

  // 2. Lấy thông tin tổng hợp
  const holiday = await findHoliday(ngaySql);
  const lamBu = await isLamBu(nhan_vien_id, ngaySql);
  const leaveRequest = await checkApprovedLeave(nhan_vien_id, ngaySql);

  // ⭐ DETECT CHỦ NHẬT
  const dateObj = new Date(ngaySql);
  const isSunday = dateObj.getDay() === 0; // 0 là Chủ nhật

  const note = (ghi_chu_excel || "").toLowerCase().trim();

  // 3. Điều chỉnh mốc giờ nếu có nghỉ 0.5 ngày (để tính muộn/sớm cho đúng)
  if (leaveRequest?.so_ngay === 0.5) {
    if (leaveRequest.buoi_nghi === "sang") {
      targetIn = 13 * 60; // Nghỉ sáng -> Chiều 13:00 mới phải vào
    } else if (leaveRequest.buoi_nghi === "chieu") {
      targetOut = 12 * 60; // Nghỉ chiều -> Sáng 12:00 được về
    }
  }

  // Biến kết quả
  let trang_thai = "di_lam";
  let ghi_chu = "";
  let gio_tang_ca = 0;
  let tong_gio = 0;
  const pieces: string[] = [];

  // 4. Tính tổng giờ làm
  const [records]: any = await pool.query(
    `SELECT gio_vao, gio_ra FROM cham_cong WHERE nhan_vien_id = ? AND ngay_lam = ? ORDER BY gio_vao ASC`,
    [nhan_vien_id, ngaySql]
  );

  let totalMinutes = 0;
  if (records.length > 0) {
    for (const r of records) {
      const sv = toMinutes(r.gio_vao);
      const ev = toMinutes(r.gio_ra);
      if (ev > sv) totalMinutes += ev - sv;
    }
    const f = toMinutes(records[0]?.gio_vao);
    const l = toMinutes(records.at(-1)?.gio_ra);
    // Trừ giờ trưa nếu làm thông (vào trước 12h, ra sau 13h)
    if (records.length === 1 && f < 12 * 60 && l > 13 * 60) totalMinutes -= 60;
  } else {
    const s = toMinutes(gio_vao_excel || "");
    const e = toMinutes(gio_ra_excel || "");
    if (e > s) {
      totalMinutes = e - s;
      if (s < 12 * 60 && e > 13 * 60) totalMinutes -= 60;
    }
  }
  tong_gio = Math.max(0, Number((totalMinutes / 60).toFixed(2)));

  // =================================================================
  // ⭐ ƯU TIÊN 1: NGÀY LỄ / TẾT (Cao nhất)
  // =================================================================
  const isLamBuDay = lamBu || holiday?.loai === "lam_bu";

  if (holiday && holiday.loai !== "cuoi_tuan" && !isLamBuDay) {
    if (holiday.loai === "le") pieces.push("Ngày lễ");
    else if (holiday.loai === "tet") pieces.push("Ngày Tết");

    if (tong_gio > 0) {
      gio_tang_ca = tong_gio * 3.0; // Đi làm lễ x3
      pieces.push("(Đi làm)");
    } else {
      // Nghỉ lễ hưởng lương -> Trả về ngay để không bị tính là Vắng
      return {
        trang_thai: "di_lam", // Vẫn để di_lam để tính lương P1, ghi chú sẽ báo là Lễ
        ghi_chu: pieces.join(", "),
        tong_gio: 0,
        gio_tang_ca: 0,
      };
    }
    ghi_chu = pieces.join(", ");
    return { trang_thai: "di_lam", ghi_chu, tong_gio, gio_tang_ca };
  }

  // =================================================================
  // ⭐ ƯU TIÊN 2: CHỦ NHẬT (Trừ khi làm bù)
  // =================================================================
  if (isSunday && !isLamBuDay) {
    if (tong_gio > 0) {
      gio_tang_ca = tong_gio * 2.0; // Đi làm CN x2
      ghi_chu = "Làm việc Chủ nhật";
      return { trang_thai: "di_lam", ghi_chu, tong_gio, gio_tang_ca };
    } else {
      // Nghỉ chủ nhật -> Trả về bình thường
      return { trang_thai: "di_lam", ghi_chu: "Nghỉ cuối tuần", tong_gio: 0, gio_tang_ca: 0 };
    }
  }

  // =================================================================
  // ⭐ CÁC TRƯỜNG HỢP CÒN LẠI (Ngày thường hoặc Làm bù)
  // =================================================================
  if (isLamBuDay) pieces.push("Làm bù");

  // --- Check Đơn nghỉ phép ---
  if (leaveRequest) {
    const loaiMap: any = {
      phep_nam: "nghi_phep",
      om_dau: "nghi_phep",
      khong_luong: "vang_khong_phep",
      khac: "nghi_phep",
    };

    if (Number(leaveRequest.so_ngay) === 0.5) {
      pieces.push(`Nghỉ phép ${leaveRequest.buoi_nghi} (0.5)`);
      // Vẫn chạy tiếp để tính đi muộn/về sớm cho buổi còn lại
    } else {
      return {
        trang_thai: loaiMap[leaveRequest.loai_nghi] || "nghi_phep",
        ghi_chu: `Nghỉ phép: ${leaveRequest.ly_do}`,
        tong_gio: 0,
        gio_tang_ca: 0,
      };
    }
  } else if (tong_gio === 0) {
    // Không có đơn, không giờ làm -> Check ghi chú
    if (note.includes("phép"))
      return {
        trang_thai: "nghi_phep",
        ghi_chu: "Nghỉ phép (Không đơn)",
        tong_gio: 0,
        gio_tang_ca: 0,
      };
    if (note.includes("vắng") || (!records.length && !gio_vao_excel))
      return {
        trang_thai: "vang_khong_phep",
        ghi_chu: "Vắng không phép",
        tong_gio: 0,
        gio_tang_ca: 0,
      };
  }

  // --- Tính Muộn / Sớm (Dựa trên targetIn/targetOut đã điều chỉnh) ---
  const vao = toMinutes(gio_vao_excel || records[0]?.gio_vao);
  const ra = toMinutes(gio_ra_excel || records.at(-1)?.gio_ra);

  if (vao > 0 && ra > 0) {
    const late = vao - targetIn;
    const early = targetOut - ra;

    const isLate = late > 0;
    const isEarly = early > 0;

    // Logic trạng thái kết hợp
    if (isLate && isEarly) {
      trang_thai = "di_muon_ve_som"; // Vừa đi muộn vừa về sớm
    } else if (isLate) {
      trang_thai = "di_muon";
    } else if (isEarly) {
      trang_thai = "ve_som";
    }

    // Thêm ghi chú
    if (isLate) {
      if (late <= 10) pieces.push("Đi muộn ≤10p");
      else if (late <= 60) pieces.push("Đi muộn ≤60p");
      else pieces.push("Đi muộn >60p");
    }
    if (isEarly) {
      if (early <= 60) pieces.push("Về sớm ≤60p");
      else pieces.push("Về sớm >60p");
    }
  }

  // --- Tăng ca ngày thường ---
  if (tong_gio > 8) {
    const ot = tong_gio - 8;
    gio_tang_ca = ot * 1.5; // Ngày thường x1.5
    pieces.push(`TC ${ot.toFixed(2)}h`);
  }

  ghi_chu = pieces.join(", ") || ghi_chu_excel || "";
  return { trang_thai, ghi_chu, tong_gio, gio_tang_ca };
}

// ==================== TẠO MỚI ====================
export const createChamCong = async (req: Request) => {
  const { nhan_vien_id, ngay_lam, gio_vao, gio_ra, ghi_chu } = req.body || {};
  if (!nhan_vien_id || !ngay_lam) return { error: "Thiếu thông tin", status: 400 };

  const scope = await getUserScope(req);
  if (scope.role === "employee") return { error: "Không có quyền", status: 403 };

  if (scope.role === "manager") {
    const isKeToan = scope.managedDepartmentNames.some((n) => n.toLowerCase().includes("kế toán"));
    if (!isKeToan) {
      const [[nv]]: any = await pool.query("SELECT phong_ban_id FROM nhan_vien WHERE id=?", [
        nhan_vien_id,
      ]);
      if (!nv || !scope.managedDepartmentIds.includes(nv.phong_ban_id))
        return { error: "Sai quyền", status: 403 };
    }
  }

  const thang = Number(String(ngay_lam).slice(5, 7));
  const nam = Number(String(ngay_lam).slice(0, 4));
  const [[ls]]: any = await pool.query(
    `SELECT trang_thai_duyet FROM luong WHERE nhan_vien_id=? AND thang=? AND nam=?`,
    [nhan_vien_id, thang, nam]
  );
  if (ls?.trang_thai_duyet === "da_duyet") return { error: "Lương đã duyệt", status: 400 };

  const rs = await evaluateChamCong(
    Number(nhan_vien_id),
    String(ngay_lam),
    gio_vao,
    gio_ra,
    ghi_chu
  );
  const [r]: any = await pool.query(
    `INSERT INTO cham_cong (nhan_vien_id, ngay_lam, gio_vao, gio_ra, ghi_chu, trang_thai, tong_gio) VALUES (?,?,?,?,?,?,?)`,
    [
      nhan_vien_id,
      ngay_lam,
      gio_vao || null,
      gio_ra || null,
      rs.ghi_chu,
      rs.trang_thai,
      rs.tong_gio,
    ]
  );
  await capNhatPhanTichCong(Number(nhan_vien_id), String(ngay_lam));
  return { data: { id: r.insertId } };
};

// ==================== CẬP NHẬT ====================
export const updateChamCong = async (req: Request) => {
  const id = Number(req.params.id);
  const { gio_vao, gio_ra, ghi_chu } = req.body || {};
  const [[old]]: any = await pool.query(
    `SELECT cc.nhan_vien_id, cc.ngay_lam, nv.phong_ban_id FROM cham_cong cc JOIN nhan_vien nv ON cc.nhan_vien_id=nv.id WHERE cc.id=?`,
    [id]
  );
  if (!old) return { error: "Not found", status: 404 };

  const scope = await getUserScope(req);
  if (scope.role === "employee") return { error: "Không có quyền", status: 403 };
  if (scope.role === "manager") {
    const isKeToan = scope.managedDepartmentNames.some((n) => n.toLowerCase().includes("kế toán"));
    if (!isKeToan && !scope.managedDepartmentIds.includes(old.phong_ban_id))
      return { error: "Sai quyền", status: 403 };
  }

  const thang = Number(String(old.ngay_lam).slice(5, 7));
  const nam = Number(String(old.ngay_lam).slice(0, 4));
  const [[ls]]: any = await pool.query(
    `SELECT trang_thai_duyet FROM luong WHERE nhan_vien_id=? AND thang=? AND nam=?`,
    [old.nhan_vien_id, thang, nam]
  );
  if (ls?.trang_thai_duyet === "da_duyet") return { error: "Lương đã duyệt", status: 400 };

  const rs = await evaluateChamCong(
    Number(old.nhan_vien_id),
    String(old.ngay_lam),
    gio_vao,
    gio_ra,
    ghi_chu
  );
  const [r]: any = await pool.query(
    `UPDATE cham_cong SET gio_vao=?, gio_ra=?, ghi_chu=?, trang_thai=?, tong_gio=? WHERE id=?`,
    [gio_vao || null, gio_ra || null, rs.ghi_chu, rs.trang_thai, rs.tong_gio, id]
  );
  await capNhatPhanTichCong(Number(old.nhan_vien_id), String(old.ngay_lam));
  return r.affectedRows > 0;
};

// ==================== LẤY DANH SÁCH (GIỮ NGUYÊN) ====================
export const getList = async (req: Request) => {
  const scope = await getUserScope(req);
  const {
    page = 1,
    limit = 10,
    nhan_vien_id,
    ten_nhan_vien,
    from,
    to,
    phong_ban_id,
    trang_thai,
  } = req.query as any;
  const offset = (Number(page) - 1) * Number(limit);
  const w: string[] = [];
  const p: any[] = [];

  if (nhan_vien_id) {
    w.push("cc.nhan_vien_id=?");
    p.push(nhan_vien_id);
  }
  if (ten_nhan_vien) {
    w.push("nv.ho_ten LIKE ?");
    p.push(`%${ten_nhan_vien}%`);
  }
  if (from) {
    w.push("cc.ngay_lam >= ?");
    p.push(from);
  }
  if (to) {
    w.push("cc.ngay_lam <= ?");
    p.push(to);
  }
  if (phong_ban_id) {
    w.push("nv.phong_ban_id = ?");
    p.push(phong_ban_id);
  }
  if (trang_thai) {
    w.push("cc.trang_thai = ?");
    p.push(trang_thai);
  }

  if (scope.role === "employee") {
    w.push("cc.nhan_vien_id=?");
    p.push(scope.employeeId);
  }
  const isKeToan =
    scope.role === "manager" &&
    scope.managedDepartmentNames.some((n) => n.toLowerCase().includes("kế toán"));
  if (scope.role === "manager" && !isKeToan) {
    w.push(
      `nv.phong_ban_id IN (${scope.managedDepartmentIds.length ? scope.managedDepartmentIds.join(",") : "0"})`
    );
  }

  const where = w.length ? `WHERE ${w.join(" AND ")}` : "";
  const [[{ total }]]: any = await pool.query(
    `SELECT COUNT(*) as total FROM cham_cong cc JOIN nhan_vien nv ON cc.nhan_vien_id=nv.id ${where}`,
    p
  );
  const [rows]: any = await pool.query(
    `SELECT cc.id, DATE_FORMAT(cc.ngay_lam, '%Y-%m-%d') as ngay_lam, cc.nhan_vien_id, cc.gio_vao, cc.gio_ra, cc.ghi_chu, cc.trang_thai, cc.tong_gio, nv.ho_ten, pb.ten_phong_ban, cv.ten_chuc_vu FROM cham_cong cc JOIN nhan_vien nv ON cc.nhan_vien_id=nv.id LEFT JOIN phong_ban pb ON nv.phong_ban_id=pb.id LEFT JOIN chuc_vu cv ON nv.chuc_vu_id=cv.id ${where} ORDER BY cc.ngay_lam DESC LIMIT ? OFFSET ?`,
    [...p, Number(limit), offset]
  );

  return { items: rows, total, page: Number(page), limit: Number(limit) };
};

// ==================== XOÁ ====================
export const deleteChamCong = async (req: Request) => {
  const id = Number(req.params.id);
  const [[row]]: any = await pool.query(
    `SELECT cc.nhan_vien_id, cc.ngay_lam, nv.phong_ban_id FROM cham_cong cc JOIN nhan_vien nv ON cc.nhan_vien_id=nv.id WHERE cc.id=?`,
    [id]
  );
  if (!row) return { error: "Not found", status: 404 };

  const scope = await getUserScope(req);
  if (scope.role === "employee") return { error: "Không có quyền", status: 403 };
  if (scope.role === "manager") {
    const isKeToan = scope.managedDepartmentNames.some((n) => n.toLowerCase().includes("kế toán"));
    if (!isKeToan && !scope.managedDepartmentIds.includes(row.phong_ban_id))
      return { error: "Sai quyền", status: 403 };
  }

  const thang = Number(String(row.ngay_lam).slice(5, 7));
  const nam = Number(String(row.ngay_lam).slice(0, 4));
  const [[ls]]: any = await pool.query(
    `SELECT trang_thai_duyet FROM luong WHERE nhan_vien_id=? AND thang=? AND nam=?`,
    [row.nhan_vien_id, thang, nam]
  );
  if (ls?.trang_thai_duyet === "da_duyet") return { error: "Lương đã duyệt", status: 400 };

  await pool.query(`DELETE FROM cham_cong WHERE id=?`, [id]);
  await capNhatPhanTichCong(Number(row.nhan_vien_id), String(row.ngay_lam));
  return { message: "Deleted" };
};
