import { Request } from "express";
import { pool } from "../db";
import { findHoliday } from "./ngayLeService";
import { capNhatTongGioLam } from "./tongGioService";

// ==================== LẤY PHẠM VI NGƯỜI DÙNG ====================
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

// ==================== HÀM TÍNH CHẤM CÔNG ====================
export async function evaluateChamCong(
  nhan_vien_id: number,
  ngay_lam: string,
  gio_vao: string,
  gio_ra: string,
  ghi_chu_excel?: string
) {
  // --- Lấy hệ số lương của nhân viên ---
  const [[nv]]: any = await pool.query("SELECT he_so_luong FROM nhan_vien WHERE id = ?", [
    nhan_vien_id,
  ]);
  const he_so_luong = nv?.he_so_luong ?? 1;

  // --- Lấy ngày lễ nếu có ---
  const holiday = await findHoliday(ngay_lam);

  const toMinutes = (t: string): number => {
    if (!t) return 0;
    const [h = 0, m = 0] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const GIO_VAO = 8 * 60; // 08:00
  const GIO_RA = 17 * 60; // 17:00
  const LUNCH_START = 12 * 60;
  const LUNCH_END = 13 * 60;

  let trang_thai = "di_lam";
  let ghi_chu = "";
  let tong_gio = 0;
  let diem_cong = 1;
  const pieces: string[] = [];

  // --- Tổng giờ làm (trừ nghỉ trưa) ---
  if (gio_vao && gio_ra) {
    let total = toMinutes(gio_ra) - toMinutes(gio_vao);
    if (toMinutes(gio_vao) < LUNCH_END && toMinutes(gio_ra) > LUNCH_START) {
      total -= Math.min(toMinutes(gio_ra), LUNCH_END) - Math.max(toMinutes(gio_vao), LUNCH_START);
    }
    tong_gio = Math.max(0, total / 60);
  }

  // --- Nếu là ngày lễ (trừ lam_bu) ---
  if (holiday && holiday.loai !== "lam_bu") {
    return {
      trang_thai: "ngay_le",
      ghi_chu: `Ngày lễ: ${holiday.ten_ngay}`,
      tong_gio,
      diem_cong,
      he_so_luong,
    };
  }

  // --- Ghi chú có phép / nghỉ ---
  const note = (ghi_chu_excel || "").toLowerCase().trim();
  const isPermit = note.includes("có phép") || note.includes("co phep");
  if (isPermit) {
    if (note.includes("về sớm") || note.includes("ve som"))
      return {
        trang_thai: "ve_som_co_phep",
        ghi_chu: "Về sớm có phép",
        tong_gio,
        diem_cong,
        he_so_luong,
      };
    if (note.includes("đi muộn") || note.includes("di muon"))
      return {
        trang_thai: "di_muon_co_phep",
        ghi_chu: "Đi muộn có phép",
        tong_gio,
        diem_cong,
        he_so_luong,
      };
    if (note.includes("nghỉ") || note.includes("nghi"))
      return { trang_thai: "nghi_phep", ghi_chu: "Nghỉ có phép", tong_gio, diem_cong, he_so_luong };
  }

  // --- Bắt đầu tính theo giờ ---
  const vao = toMinutes(gio_vao);
  const ra = toMinutes(gio_ra);
  const late = vao - GIO_VAO; // >0 là đi muộn
  const delta = ra - GIO_RA; // +: tăng ca, -: về sớm

  let bi_muon = false;
  let ve_som = false;

  // --- Đi muộn ---
  if (late > 10) {
    bi_muon = true;
    if (late <= 30) pieces.push("Đi muộn (trừ 0.25h)");
    else if (late <= 60) pieces.push("Đi muộn (trừ 0.5h)");
    else pieces.push("Đi muộn (trừ 1.0h)");
  }

  // --- Về sớm / Tăng ca ---
  if (delta < -10) {
    ve_som = true;
    const early = -delta;
    if (early <= 30) pieces.push("Về sớm (trừ 0.25h)");
    else if (early <= 60) pieces.push("Về sớm (trừ 0.5h)");
    else pieces.push("Về sớm (trừ 1.0h)");
  } else if (delta > 10) {
    const gio_tang_ca = delta / 60;
    pieces.push(`Tăng ca ${gio_tang_ca.toFixed(2)}h`);
  }

  // --- Nếu không có ghi chú nào, coi là bình thường ---
  ghi_chu = pieces.length > 0 ? pieces.join(", ") : "Bình thường";

  // --- Xác định trạng thái ---
  if (bi_muon && ve_som) {
    trang_thai = "di_muon_ve_som";
    diem_cong = 0;
  } else if (bi_muon) {
    trang_thai = "di_muon";
  } else if (ve_som) {
    trang_thai = "ve_som";
  } else {
    trang_thai = "di_lam";
  }

  return { trang_thai, ghi_chu, tong_gio, diem_cong, he_so_luong };
}

// ==================== TẠO MỚI ====================
export const createChamCong = async (req: Request) => {
  const { nhan_vien_id, ngay_lam, gio_vao, gio_ra, ghi_chu } = req.body || {};
  if (!nhan_vien_id || !ngay_lam) return { error: "Thiếu nhân viên hoặc ngày", status: 400 };

  const {
    trang_thai,
    ghi_chu: ghiChuAuto,
    tong_gio,
  } = await evaluateChamCong(nhan_vien_id, ngay_lam, gio_vao, gio_ra, ghi_chu);

  const [r]: any = await pool.query(
    `INSERT INTO cham_cong (nhan_vien_id, ngay_lam, gio_vao, gio_ra, ghi_chu, trang_thai, tong_gio)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [nhan_vien_id, ngay_lam, gio_vao, gio_ra, ghiChuAuto, trang_thai, tong_gio]
  );

  await capNhatTongGioLam(nhan_vien_id, ngay_lam);
  return { data: { id: r.insertId } };
};

// ==================== CẬP NHẬT ====================
export const updateChamCong = async (req: Request) => {
  const id = Number(req.params.id);
  const { nhan_vien_id, ngay_lam, gio_vao, gio_ra, ghi_chu } = req.body || {};
  if (!Number.isFinite(id) || id <= 0) return null;

  const {
    trang_thai,
    ghi_chu: ghiChuAuto,
    tong_gio,
  } = await evaluateChamCong(nhan_vien_id, ngay_lam, gio_vao, gio_ra, ghi_chu);

  const [r]: any = await pool.query(
    `UPDATE cham_cong
     SET nhan_vien_id=?, ngay_lam=?, gio_vao=?, gio_ra=?, ghi_chu=?, trang_thai=?, tong_gio=?
     WHERE id=?`,
    [nhan_vien_id, ngay_lam, gio_vao, gio_ra, ghiChuAuto, trang_thai, tong_gio, id]
  );

  await capNhatTongGioLam(nhan_vien_id, ngay_lam);
  return r.affectedRows > 0;
};

// ==================== LẤY DANH SÁCH ====================
export const getList = async (req: Request) => {
  const { page = 1, limit = 10, from, to } = req.query as any;
  const offset = (Number(page) - 1) * Number(limit);

  const where: string[] = [];
  const params: any[] = [];

  if (from) {
    where.push("cc.ngay_lam >= ?");
    params.push(from);
  }
  if (to) {
    where.push("cc.ngay_lam <= ?");
    params.push(to);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[{ total }]]: any = await pool.query(
    `SELECT COUNT(*) AS total FROM cham_cong cc ${whereSql}`,
    params
  );

  const [rows]: any = await pool.query(
    `SELECT
        cc.*,
        nv.ho_ten,
        nv.he_so_luong,
        pb.ten_phong_ban AS phong_ban,
        cv.ten_chuc_vu AS chuc_vu
     FROM cham_cong cc
     JOIN nhan_vien nv ON cc.nhan_vien_id = nv.id
     LEFT JOIN phong_ban pb ON nv.phong_ban_id = pb.id
     LEFT JOIN chuc_vu cv ON nv.chuc_vu_id = cv.id
     ${whereSql}
     ORDER BY cc.ngay_lam DESC, nv.ho_ten ASC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), offset]
  );

  return {
    items: rows,
    total,
    page: Number(page),
    limit: Number(limit),
  };
};
