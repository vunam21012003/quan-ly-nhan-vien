//chamCongService.ts
import { Request } from "express";
import { pool } from "../db";
import { capNhatPhanTichCong } from "./phanTichCongService";
import * as thongBaoService from "./thongBaoService";
import { xuLyTuDongChamCong } from "../scripts/autoChamCong";

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

// HÀM TÍNH CHẤM CÔNG
export async function evaluateChamCong(
  nhan_vien_id: number,
  ngay_lam: string,
  gio_vao_excel?: string | null,
  gio_ra_excel?: string | null,
  ghi_chu_excel?: string,
  input_loai_ngay?: "le" | "tet" | "lam_bu" | "thuong" //
) {
  const ngaySql = String(ngay_lam).slice(0, 10);

  let targetIn = 8 * 60;
  let targetOut = 17 * 60;
  const MAX_END_MINUTES = 22 * 60;
  //  Lấy thông tin tổng hợp

  const leaveRequest = await checkApprovedLeave(nhan_vien_id, ngaySql);

  const dateObj = new Date(ngaySql);
  const isSunday = dateObj.getDay() === 0;

  const note = (ghi_chu_excel || "").toLowerCase().trim();

  if (leaveRequest?.so_ngay === 0.5) {
    if (leaveRequest.buoi_nghi === "sang") {
      targetIn = 13 * 60;
    } else if (leaveRequest.buoi_nghi === "chieu") {
      targetOut = 12 * 60;
    }
  }

  let trang_thai = "di_lam";
  let ghi_chu = "";
  let gio_tang_ca = 0;
  let tong_gio = 0;
  const pieces: string[] = [];

  // Xác định loại ngày
  let loai_ngay: "le" | "tet" | "lam_bu" | "thuong" = input_loai_ngay || "thuong";

  // Tính tổng giờ làm
  const [records]: any = await pool.query(
    `SELECT gio_vao, gio_ra FROM cham_cong WHERE nhan_vien_id = ? AND ngay_lam = ? ORDER BY gio_vao ASC`,
    [nhan_vien_id, ngaySql]
  );

  let totalMinutes = 0;
  if (records.length > 0) {
    for (const r of records) {
      let sv = toMinutes(r.gio_vao);
      let ev = toMinutes(r.gio_ra);

      if (ev > MAX_END_MINUTES) ev = MAX_END_MINUTES;

      if (ev > sv) totalMinutes += ev - sv;
    }
    const f = toMinutes(records[0]?.gio_vao);
    let l = toMinutes(records.at(-1)?.gio_ra);
    if (l > MAX_END_MINUTES) l = MAX_END_MINUTES;

    if (records.length === 1 && f < 12 * 60 && l > 13 * 60) totalMinutes -= 60;
  } else {
    let s = toMinutes(gio_vao_excel || "");
    let e = toMinutes(gio_ra_excel || "");

    if (e > MAX_END_MINUTES) e = MAX_END_MINUTES;

    if (e > s) {
      totalMinutes = e - s;
      if (s < 12 * 60 && e > 13 * 60) totalMinutes -= 60;
    }
  }
  tong_gio = Math.max(0, Number((totalMinutes / 60).toFixed(2)));

  // NGÀY LỄ / TẾT / LÀM BÙ
  if (loai_ngay === "le" || loai_ngay === "tet") {
    if (loai_ngay === "le") pieces.push("Ngày lễ");
    else if (loai_ngay === "tet") pieces.push("Ngày Tết");

    if (tong_gio > 0) {
      const he_so = loai_ngay === "tet" ? 3.0 : 2.0;
      gio_tang_ca = tong_gio * he_so;

      pieces.push("(Đi làm)");
      ghi_chu = pieces.join(", ");
      return { trang_thai: "di_lam", ghi_chu, tong_gio, gio_tang_ca, loai_ngay };
    } else {
      // Nghỉ lễ hưởng lương
      return {
        trang_thai: "di_lam",
        ghi_chu: pieces.join(", "),
        tong_gio: 0,
        gio_tang_ca: 0,
        loai_ngay,
      };
    }
  }

  if (loai_ngay === "lam_bu") {
    pieces.push("Làm bù");
  }

  // CHỦ NHẬT
  if (isSunday && loai_ngay !== "lam_bu") {
    if (tong_gio > 0) {
      gio_tang_ca = tong_gio * 2.0;
      ghi_chu = "Làm việc Chủ nhật";
      return { trang_thai: "di_lam", ghi_chu, tong_gio, gio_tang_ca, loai_ngay };
    } else {
      return {
        trang_thai: "di_lam",
        ghi_chu: "Nghỉ cuối tuần",
        tong_gio: 0,
        gio_tang_ca: 0,
        loai_ngay,
      };
    }
  }

  if (leaveRequest) {
    const loaiMap: any = {
      phep_nam: "nghi_phep",
      om_dau: "nghi_phep",
      khong_luong: "vang_khong_phep",
      khac: "nghi_phep",
    };

    if (Number(leaveRequest.so_ngay) === 0.5) {
      pieces.push(`Nghỉ phép ${leaveRequest.buoi_nghi} (0.5)`);
    } else {
      return {
        trang_thai: loaiMap[leaveRequest.loai_nghi] || "nghi_phep",
        ghi_chu: `Nghỉ phép: ${leaveRequest.ly_do}`,
        tong_gio: 0,
        gio_tang_ca: 0,
        loai_ngay,
      };
    }
  } else if (tong_gio === 0) {
    if (note.includes("phép"))
      return {
        trang_thai: "nghi_phep",
        ghi_chu: "Nghỉ phép (Không đơn)",
        tong_gio: 0,
        gio_tang_ca: 0,
        loai_ngay,
      };
    if (note.includes("vắng") || (!records.length && !gio_vao_excel))
      return {
        trang_thai: "vang_khong_phep",
        ghi_chu: "Vắng không phép",
        tong_gio: 0,
        gio_tang_ca: 0,
        loai_ngay,
      };
  }

  // --- Tính Muộn / Sớm  ---
  const vao = toMinutes(gio_vao_excel || records[0]?.gio_vao);
  const ra = toMinutes(gio_ra_excel || records.at(-1)?.gio_ra);

  if (vao > 0 && ra > 0 && ra > vao) {
    const late = vao - targetIn;
    const early = targetOut - ra;

    const isLate = late > 0;
    const isEarly = early > 0;

    if (isLate && isEarly) {
      trang_thai = "di_muon_ve_som";
    } else if (isLate) {
      trang_thai = "di_muon";
    } else if (isEarly) {
      trang_thai = "ve_som";
    }

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
    gio_tang_ca = ot * 1.5;
    pieces.push(`TC ${ot.toFixed(2)}h`);
  }

  ghi_chu = pieces.join(", ") || ghi_chu_excel || "";
  return { trang_thai, ghi_chu, tong_gio, gio_tang_ca, loai_ngay };
}

// ==================== TẠO MỚI ====================
export const createChamCong = async (req: Request) => {
  const { nhan_vien_id, ngay_lam, gio_vao, gio_ra, ghi_chu, loai_ngay } = req.body || {};
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

  if (gio_vao && gio_ra) {
    const start = toMinutes(gio_vao);
    const end = toMinutes(gio_ra);
    if (end <= start) {
      return { error: "Giờ ra phải lớn hơn giờ vào trong cùng ngày", status: 400 };
    }
  }

  const rs = await evaluateChamCong(
    Number(nhan_vien_id),
    String(ngay_lam),
    gio_vao,
    gio_ra,
    ghi_chu,
    loai_ngay
  );
  const [r]: any = await pool.query(
    `INSERT INTO cham_cong
    (nhan_vien_id, ngay_lam, gio_vao, gio_ra, trang_thai, ghi_chu, tong_gio, loai_ngay)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      nhan_vien_id,
      ngay_lam,
      gio_vao || null,
      gio_ra || null,
      rs.trang_thai,
      rs.ghi_chu,
      rs.tong_gio,
      rs.loai_ngay || "thuong",
    ]
  );
  await capNhatPhanTichCong(Number(nhan_vien_id), String(ngay_lam));
  return { data: { id: r.insertId } };
};

// ==================== CẬP NHẬT ====================
export const updateChamCong = async (req: Request) => {
  const id = Number(req.params.id);
  const { gio_vao, gio_ra, ghi_chu, loai_ngay, ngay_lam } = req.body || {};

  // Lấy bản ghi cũ
  const [[old]]: any = await pool.query(
    `SELECT cc.nhan_vien_id, cc.ngay_lam, nv.phong_ban_id 
       FROM cham_cong cc 
       JOIN nhan_vien nv ON cc.nhan_vien_id = nv.id 
      WHERE cc.id=?`,
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

  // ngày cũ và ngày mới
  const ngayCu = String(old.ngay_lam).slice(0, 10);
  const ngayMoi = (ngay_lam ? String(ngay_lam) : ngayCu).slice(0, 10);

  // Check lương theo THÁNG MỚI
  const thangMoi = Number(ngayMoi.slice(5, 7));
  const namMoi = Number(ngayMoi.slice(0, 4));
  const [[ls]]: any = await pool.query(
    `SELECT trang_thai_duyet FROM luong WHERE nhan_vien_id=? AND thang=? AND nam=?`,
    [old.nhan_vien_id, thangMoi, namMoi]
  );
  if (ls?.trang_thai_duyet === "da_duyet") return { error: "Lương đã duyệt", status: 400 };

  // Tính lại chấm công với NGÀY MỚI
  const rs = await evaluateChamCong(
    Number(old.nhan_vien_id),
    ngayMoi,
    gio_vao,
    gio_ra,
    ghi_chu,
    loai_ngay
  );

  // Cập nhật bảng cham_cong
  const [r]: any = await pool.query(
    `UPDATE cham_cong 
        SET ngay_lam = ?, gio_vao = ?, gio_ra = ?, ghi_chu = ?, 
            trang_thai = ?, tong_gio = ?, loai_ngay = ?
      WHERE id = ?`,
    [
      ngayMoi,
      gio_vao || null,
      gio_ra || null,
      rs.ghi_chu,
      rs.trang_thai,
      rs.tong_gio,
      rs.loai_ngay,
      id,
    ]
  );

  // Cập nhật lại PHÂN TÍCH CÔNG
  const thangCu = Number(ngayCu.slice(5, 7));
  const namCu = Number(ngayCu.slice(0, 4));

  if (thangCu !== thangMoi || namCu !== namMoi) {
    await capNhatPhanTichCong(Number(old.nhan_vien_id), ngayCu);
  }

  // Luôn tính lại tháng mới
  await capNhatPhanTichCong(Number(old.nhan_vien_id), ngayMoi);
  // ==================== GỬI THÔNG BÁO KHI UPDATE ====================
  try {
    const [[updated]]: any = await pool.query(
      `SELECT gio_vao, gio_ra, ghi_chu, trang_thai, tong_gio, loai_ngay 
     FROM cham_cong WHERE id=?`,
      [id]
    );

    const thayDoi: string[] = [];
    if (gio_vao !== undefined && gio_vao !== old.gio_vao) thayDoi.push("Giờ vào");
    if (gio_ra !== undefined && gio_ra !== old.gio_ra) thayDoi.push("Giờ ra");
    if (ghi_chu !== undefined && ghi_chu !== old.ghi_chu) thayDoi.push("Ghi chú");
    if (loai_ngay !== undefined && loai_ngay !== old.loai_ngay) thayDoi.push("Loại ngày");
    if (ngayMoi !== ngayCu) thayDoi.push("Ngày làm");

    if (thayDoi.length > 0) {
      const noiDung = `Chấm công ngày ${ngayMoi} của bạn đã được cập nhật: ${thayDoi.join(", ")}.`;

      await thongBaoService.tao({
        nguoi_nhan_id: old.nhan_vien_id,
        loai: "cham_cong",
        tieu_de: "Chấm công đã được cập nhật",
        noi_dung: noiDung,
        tham_chieu_loai: "cham_cong",
        tham_chieu_id: id,
        nguoi_tao_id: req.user!.id,
      });
    }
  } catch (e) {
    console.error("Lỗi thông báo update chấm công:", e);
  }

  return r.affectedRows > 0;
};

// ==================== LẤY DANH SÁCH ====================
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
    `SELECT cc.id, DATE_FORMAT(cc.ngay_lam, '%Y-%m-%d') as ngay_lam, cc.nhan_vien_id, cc.gio_vao, cc.gio_ra, cc.ghi_chu, cc.trang_thai, cc.tong_gio, cc.loai_ngay, nv.ho_ten, pb.ten_phong_ban, cv.ten_chuc_vu 
    FROM cham_cong cc 
    JOIN nhan_vien nv ON cc.nhan_vien_id=nv.id 
    LEFT JOIN phong_ban pb ON nv.phong_ban_id=pb.id 
    LEFT JOIN chuc_vu cv ON nv.chuc_vu_id=cv.id 
    ${where} 
    ORDER BY cc.ngay_lam DESC LIMIT ? OFFSET ?`,
    [...p, Number(limit), offset]
  );

  return { items: rows, total, page: Number(page), limit: Number(limit) };
};

// ==================== XOÁ ====================
export const deleteChamCong = async (req: Request) => {
  const id = Number(req.params.id);
  const [[row]]: any = await pool.query(
    `SELECT cc.nhan_vien_id, cc.ngay_lam, nv.phong_ban_id 
    FROM cham_cong cc 
    JOIN nhan_vien nv ON cc.nhan_vien_id=nv.id 
    WHERE cc.id=?`,
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

export const autoProcessChamCong = async (ngayXuLy?: string) => {
  return await xuLyTuDongChamCong(ngayXuLy, false);
};
