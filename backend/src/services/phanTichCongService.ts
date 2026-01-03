// src/services/phanTichCongService.ts
import { pool } from "../db";
import { Request } from "express";

// Hàm chuyển đổi giờ:phút sang phút
const toMinutes = (t: string | null): number => {
  if (!t) return 0;
  const [h = 0, m = 0] = String(t).split(":").map(Number);
  return h * 60 + m;
};

//  HÀM CẬP NHẬT TỔNG HỢP
export async function capNhatPhanTichCong(nhan_vien_id: number, anyDate: string) {
  const ngay = String(anyDate).slice(0, 10);
  const thang = Number(ngay.slice(5, 7));
  const nam = Number(ngay.slice(0, 4));

  // Xoá phân tích cũ để tính lại
  await pool.query(
    `DELETE FROM phan_tich_cong 
      WHERE nhan_vien_id = ? AND thang = ? AND nam = ?`,
    [nhan_vien_id, thang, nam]
  );

  // Lấy dữ liệu chấm công đã có trong tháng
  const [rows]: any = await pool.query(
    `SELECT ngay_lam, trang_thai, tong_gio, loai_ngay
       FROM cham_cong
      WHERE nhan_vien_id = ?
        AND MONTH(ngay_lam) = ?
        AND YEAR(ngay_lam) = ?`,
    [nhan_vien_id, thang, nam]
  );

  const dbHolidays: Record<string, boolean> = {};
  if (rows) {
    for (const r of rows) {
      if (r.loai_ngay === "le" || r.loai_ngay === "tet") {
        dbHolidays[String(r.ngay_lam).slice(0, 10)] = true;
      }
    }
  }

  // Khởi tạo biến tổng
  let tong_gio = 0;
  let gio_tang_ca = 0;
  let so_ngay_cong = 0;
  let so_ngay_nghi_huong_luong = 0;
  let so_ngay_nghi_phep = 0;
  let so_ngay_nghi_khong_phep = 0;

  // Lấy danh sách đơn nghỉ phép
  const [leaveRows]: any = await pool.query(
    `SELECT nhan_vien_id, ngay_bat_dau, ngay_ket_thuc, so_ngay, buoi_nghi
   FROM don_nghi_phep
   WHERE nhan_vien_id = ?
     AND trang_thai = 'da_duyet'
     AND (
       (MONTH(ngay_bat_dau) = ? AND YEAR(ngay_bat_dau) = ?)
       OR (MONTH(ngay_ket_thuc) = ? AND YEAR(ngay_ket_thuc) = ?)
     )`,
    [nhan_vien_id, thang, nam, thang, nam]
  );

  const leaveByDate: Record<string, { so_ngay: number; buoi_nghi: string }> = {};

  for (const leave of leaveRows) {
    const start = new Date(leave.ngay_bat_dau);
    const end = new Date(leave.ngay_ket_thuc);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      const dayOfWeek = d.getDay();
      const dateNum = d.getDate();
      const monthNum = d.getMonth() + 1;

      // Check Lễ cố định (Dương lịch)
      const isFixedHoliday =
        (dateNum === 1 && monthNum === 1) ||
        (dateNum === 30 && monthNum === 4) ||
        (dateNum === 1 && monthNum === 5) ||
        (dateNum === 2 && monthNum === 9);

      // Check Lễ động từ DB
      const isDbHoliday = dbHolidays[dateStr];

      if (dayOfWeek !== 0 && !isFixedHoliday && !isDbHoliday) {
        let val = 1;
        if (
          leave.buoi_nghi === "sang" ||
          leave.buoi_nghi === "chieu" ||
          Number(leave.so_ngay) === 0.5
        ) {
          val = 0.5;
        }
        leaveByDate[dateStr] = {
          so_ngay: val,
          buoi_nghi: leave.buoi_nghi,
        };
      }
    }
  }

  // Gom nhóm dữ liệu chấm công theo ngày
  interface DailyAgg {
    tong_gio: number;
    trang_thai: string;
    loai_ngay: string | null;
  }
  const byDate: Record<string, DailyAgg> = {};

  if (rows && rows.length > 0) {
    for (const r of rows) {
      const d = String(r.ngay_lam).slice(0, 10);
      const trang_thai: string = String(r.trang_thai || "").toLowerCase();
      const tg: number = Number(r.tong_gio || 0);
      const loai_ngay: string | null = r.loai_ngay || null;

      tong_gio += tg;

      if (!byDate[d]) {
        byDate[d] = { tong_gio: 0, trang_thai, loai_ngay };
      }
      byDate[d].tong_gio += tg;

      const priority = (s: string) => {
        switch (s) {
          case "vang_khong_phep":
            return 4;
          case "nghi_phep":
            return 3;
          case "di_muon_ve_som":
            return 2;
          case "di_muon":
          case "ve_som":
            return 1;
          case "di_lam":
          default:
            return 0;
        }
      };
      if (priority(trang_thai) > priority(byDate[d].trang_thai)) {
        byDate[d].trang_thai = trang_thai;
      }
    }
  }

  // TÍNH TOÁN CHI TIẾT
  for (const d of Object.keys(byDate)) {
    const dayAgg = byDate[d] as DailyAgg;
    const st = dayAgg.trang_thai;
    const loai_ngay = (dayAgg.loai_ngay || "").toLowerCase();
    const g = dayAgg.tong_gio;

    const dateObj = new Date(d);
    const isSunday = dateObj.getDay() === 0;
    const isWorkStatus =
      st === "di_lam" || st === "di_muon" || st === "ve_som" || st === "di_muon_ve_som";

    const GIO_CHUAN = 8.0;
    const GIO_CHAM_CHUOC = 0.5;

    // Ngày thường
    if (isWorkStatus && !isSunday && loai_ngay !== "le" && loai_ngay !== "tet") {
      if (g >= GIO_CHUAN - GIO_CHAM_CHUOC) {
        so_ngay_cong += 1;
      } else if (g > 0) {
        so_ngay_cong += g / GIO_CHUAN;
      } else {
        so_ngay_nghi_khong_phep += 1;
      }
    }

    // Làm bù
    else if ((!isSunday || loai_ngay === "lam_bu") && loai_ngay !== "le" && loai_ngay !== "tet") {
      if (g >= GIO_CHUAN - GIO_CHAM_CHUOC) {
        so_ngay_cong += 1;
      } else if (g > 0) {
        so_ngay_cong += g / GIO_CHUAN;
      }
    }
    // Nghỉ phép
    else if (st === "nghi_phep") {
      const leave = leaveByDate[d];
      if (leave) {
        so_ngay_nghi_phep += leave.so_ngay;

        if (leave.so_ngay < 1) {
          if (g >= 4 - GIO_CHAM_CHUOC) {
            so_ngay_cong += 0.5;
          } else if (g > 0) {
            so_ngay_cong += g / GIO_CHUAN;
          }
        }
      } else {
        let isHolidayOrSun = dbHolidays[d] || isSunday;
        if (!isHolidayOrSun) {
          so_ngay_nghi_phep += 1;
        }
      }
    }
    // Vắng không phép
    else if (st === "vang_khong_phep") {
      so_ngay_nghi_khong_phep += 1;
    }

    // Nghỉ Lễ/Tết hưởng lương
    if ((loai_ngay === "le" || loai_ngay === "tet") && g === 0) {
      so_ngay_nghi_huong_luong += 1;
    }

    // Tính Tăng ca
    if (g > 0) {
      if (loai_ngay === "le") {
        gio_tang_ca += g * 2;
      } else if (loai_ngay === "tet") {
        gio_tang_ca += g * 3;
      } else if (isSunday && loai_ngay !== "lam_bu") {
        gio_tang_ca += g * 2;
      } else {
        if (g > 8) {
          gio_tang_ca += (g - 8) * 1.5;
        }
      }
    }
  }

  // 7. Lưu kết quả
  await pool.query(
    `INSERT INTO phan_tich_cong
       (nhan_vien_id, thang, nam,
        tong_gio, gio_tang_ca,
        so_ngay_cong, so_ngay_nghi_huong_luong,
        so_ngay_nghi_phep, so_ngay_nghi_khong_phep,
        updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      nhan_vien_id,
      thang,
      nam,
      Number(tong_gio.toFixed(2)),
      Number(gio_tang_ca.toFixed(2)),
      Number(so_ngay_cong.toFixed(4)),
      so_ngay_nghi_huong_luong,
      Number(so_ngay_nghi_phep.toFixed(2)),
      Number(so_ngay_nghi_khong_phep.toFixed(2)),
    ]
  );
}

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
