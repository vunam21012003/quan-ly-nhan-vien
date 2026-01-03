// src/services/trangChinhService.ts
import { pool } from "../db";

export type VaiTro = "admin" | "manager" | "employee";

export type PhamVi = {
  employeeId: number | null;
  managedDepartmentIds: number[];
  role: VaiTro;
  isAccountingManager?: boolean;
};

export type DashboardResponse = {
  alerts: string[];
  kpi_employee: { hours: number; days: number; late: number; leave: number } | null;
  kpi_manager: { pending_leave: number; ot: number } | null;
  kpi_admin: { total: number; salary: number } | null;
  salary: { by_department: Array<{ ten_phong_ban: string; total_salary: number }> };
  rewards: { reward_total: number; punishment_total: number };
  topEmployees: Array<{
    id: number;
    ho_ten: string;
    ten_phong_ban: string | null;
    net_contribution_score: number;
  }>;
  quick_approve: Array<{
    id: number;
    ho_ten: string;
    loai_nghi: string;
    ngay_bat_dau: string;
    ngay_ket_thuc: string;
  }>;
  notifications: Array<{
    id: number;
    tieu_de: string;
    noi_dung: string | null;
    nguoi_tao: string | null;
    created_at: string;
  }>;
};

function getMonthRange(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1));
  const end = new Date(Date.UTC(y, m + 1, 0));
  return {
    year: y,
    month: m + 1,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

// Điều chỉnh nếu DB của bạn đặt tên trạng thái khác
const WORK_STATUSES = ["di_lam", "di_muon", "ve_som", "di_muon_ve_som"];

async function kpiEmployee(employeeId: number | null) {
  if (!employeeId) return { hours: 0, days: 0, late: 0, leave: 0 };

  const { year, month, startDate, endDate } = getMonthRange();

  // 1. Lấy từ phan_tich_cong
  const [ptcRows]: any = await pool.query(
    `SELECT tong_gio, so_ngay_cong, so_ngay_nghi_phep
     FROM phan_tich_cong
     WHERE nhan_vien_id = ? AND thang = ? AND nam = ?
     LIMIT 1`,
    [employeeId, month, year]
  );

  let hours = Number(ptcRows?.[0]?.tong_gio ?? 0);
  let days = Number(ptcRows?.[0]?.so_ngay_cong ?? 0);
  let leave = Number(ptcRows?.[0]?.so_ngay_nghi_phep ?? 0);

  // 2. Fallback: nếu chưa có bản ghi phân tích công → tổng hợp từ chấm công
  if (!ptcRows?.length) {
    const [aggRows]: any = await pool.query(
      `SELECT 
          COALESCE(SUM(tong_gio), 0) AS h,
          SUM(CASE WHEN trang_thai IN (${WORK_STATUSES.map(() => "?").join(",")}) THEN 1 ELSE 0 END) AS d,
          SUM(CASE WHEN trang_thai = 'nghi_phep' THEN 1 ELSE 0 END) AS leave_days
       FROM cham_cong
       WHERE nhan_vien_id = ?
         AND ngay_lam BETWEEN ? AND ?`,
      [...WORK_STATUSES, employeeId, startDate, endDate]
    );
    hours = Number(aggRows?.[0]?.h ?? 0);
    days = Number(aggRows?.[0]?.d ?? 0);
    leave = Number(aggRows?.[0]?.leave_days ?? 0);
  }

  // 3. số lần đi muộn
  const [lateRows]: any = await pool.query(
    `SELECT COUNT(*) AS c
     FROM cham_cong
     WHERE nhan_vien_id = ?
       AND ngay_lam BETWEEN ? AND ?
       AND trang_thai IN ('di_muon','di_muon_ve_som')`,
    [employeeId, startDate, endDate]
  );

  return {
    hours: Number(hours.toFixed(2)),
    days,
    late: Number(lateRows?.[0]?.c ?? 0),
    leave,
  };
}

async function getManagerContext(managedDepartmentIds: number[]) {
  if (!managedDepartmentIds?.length) return { deptIds: [], empIds: [] };
  const placeholders = managedDepartmentIds.map(() => "?").join(",");
  const [empRows]: any = await pool.query(
    `SELECT id FROM nhan_vien WHERE phong_ban_id IN (${placeholders})`,
    managedDepartmentIds
  );
  return {
    deptIds: managedDepartmentIds,
    empIds: empRows.map((r: any) => r.id) as number[],
  };
}

async function kpiManager(managedDepartmentIds: number[]) {
  const { deptIds, empIds } = await getManagerContext(managedDepartmentIds);
  if (!deptIds.length) return { pending_leave: 0, ot: 0 };

  const { year, month } = getMonthRange();

  // Đơn nghỉ phép đang chờ duyệt cho nhân viên trong các phòng manager quản lý
  const placeholdersDept = deptIds.map(() => "?").join(",");
  const [pendRows]: any = await pool.query(
    `SELECT COUNT(*) AS c
     FROM don_nghi_phep d
     JOIN nhan_vien nv ON nv.id = d.nhan_vien_id
     WHERE d.trang_thai = 'cho_duyet'
       AND nv.phong_ban_id IN (${placeholdersDept})`,
    deptIds
  );
  const pending = Number(pendRows?.[0]?.c ?? 0);

  // Tổng giờ tăng ca tháng này
  let ot = 0;
  if (empIds.length) {
    const placeholdersEmp = empIds.map(() => "?").join(",");
    const [otRows]: any = await pool.query(
      `SELECT COALESCE(SUM(gio_tang_ca),0) AS s
       FROM phan_tich_cong
       WHERE thang = ? AND nam = ?
         AND nhan_vien_id IN (${placeholdersEmp})`,
      [month, year, ...empIds]
    );
    ot = Number(otRows?.[0]?.s ?? 0);
  }

  return {
    pending_leave: pending,
    ot: Number(ot.toFixed(2)),
  };
}

async function kpiAdmin() {
  // ===== XÁC ĐỊNH THÁNG TRƯỚC =====
  const now = new Date();

  // tháng hiện tại (1–12)
  const currentMonth = now.getUTCMonth() + 1;
  const currentYear = now.getUTCFullYear();

  // tính tháng trước
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  // Log ra để kiểm tra
  console.log("KPI ADMIN prevMonth/prevYear =", prevMonth, prevYear);

  // ===== TỔNG NHÂN VIÊN ĐANG LÀM =====
  const [totalRows]: any = await pool.query(
    `SELECT COUNT(*) AS c
     FROM nhan_vien
     WHERE trang_thai = 'dang_lam'`
  );

  // ===== QUỸ LƯƠNG THÁNG TRƯỚC TỪ BẢNG LUONG =====
  const [salaryRows]: any = await pool.query(
    `SELECT COALESCE(SUM(luong_thuc_nhan),0) AS s
     FROM luong
     WHERE thang = ? AND nam = ?
       AND trang_thai_duyet = 'da_duyet'`,
    [prevMonth, prevYear]
  );

  const total = Number(totalRows?.[0]?.c ?? 0);
  const salary = Number(salaryRows?.[0]?.s ?? 0);

  console.log("KPI ADMIN salary =", salary);

  return { total, salary };
}

async function salaryByDepartment() {
  const { year, month } = getMonthRange();
  const [rows]: any = await pool.query(
    `SELECT pb.ten_phong_ban,
            COALESCE(SUM(l.luong_thuc_nhan),0) AS total_salary
     FROM phong_ban pb
     LEFT JOIN nhan_vien nv ON nv.phong_ban_id = pb.id
     LEFT JOIN luong l ON l.nhan_vien_id = nv.id AND l.thang = ? AND l.nam = ?
     GROUP BY pb.id, pb.ten_phong_ban
     ORDER BY total_salary DESC`,
    [month, year]
  );
  return {
    by_department: rows.map((r: any) => ({
      ten_phong_ban: r.ten_phong_ban,
      total_salary: Number(r.total_salary ?? 0),
    })),
  };
}

async function rewardsTotals() {
  const { year, month } = getMonthRange();
  const [rows]: any = await pool.query(
    `SELECT UPPER(loai) AS loai, COALESCE(SUM(so_tien),0) AS s
     FROM thuong_phat
     WHERE thang = ? AND nam = ?
     GROUP BY UPPER(loai)`,
    [month, year]
  );
  const reward_total = Number(rows.find((r: any) => r.loai === "THUONG")?.s ?? 0);
  const punishment_total = Number(rows.find((r: any) => r.loai === "PHAT")?.s ?? 0);
  return { reward_total, punishment_total };
}

async function topEmployees() {
  const { year, month } = getMonthRange();
  const [rows]: any = await pool.query(
    `SELECT nv.id,
            nv.ho_ten,
            pb.ten_phong_ban,
            COALESCE(SUM(CASE WHEN UPPER(tp.loai)='THUONG' THEN tp.so_tien ELSE 0 END),0)
            - COALESCE(SUM(CASE WHEN UPPER(tp.loai)='PHAT'   THEN tp.so_tien ELSE 0 END),0)
            AS net_contribution_score
     FROM nhan_vien nv
     LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
     LEFT JOIN thuong_phat tp ON tp.nhan_vien_id = nv.id
         AND tp.thang = ? AND tp.nam = ?
     GROUP BY nv.id, nv.ho_ten, pb.ten_phong_ban
     ORDER BY net_contribution_score DESC
     LIMIT 5`,
    [month, year]
  );
  return rows.map((r: any) => ({
    id: r.id,
    ho_ten: r.ho_ten,
    ten_phong_ban: r.ten_phong_ban ?? null,
    net_contribution_score: Number(r.net_contribution_score ?? 0),
  }));
}

async function quickApprove(managedDepartmentIds: number[]) {
  if (!managedDepartmentIds?.length) return [];
  const placeholders = managedDepartmentIds.map(() => "?").join(",");
  const [rows]: any = await pool.query(
    `SELECT d.id, nv.ho_ten, d.loai_nghi, d.ngay_bat_dau, d.ngay_ket_thuc
     FROM don_nghi_phep d
     JOIN nhan_vien nv ON nv.id = d.nhan_vien_id
     WHERE d.trang_thai = 'cho_duyet'
       AND nv.phong_ban_id IN (${placeholders})
     ORDER BY d.created_at DESC
     LIMIT 5`,
    managedDepartmentIds
  );
  return rows.map((r: any) => ({
    id: r.id,
    ho_ten: r.ho_ten,
    loai_nghi: r.loai_nghi,
    ngay_bat_dau: r.ngay_bat_dau,
    ngay_ket_thuc: r.ngay_ket_thuc,
  }));
}

async function notificationsForEmployee(employeeId: number | null) {
  if (!employeeId) return [];

  const [rows]: any = await pool.query(
    `SELECT tb.id,
            tb.tieu_de,
            tb.noi_dung,
            tb.created_at,
            nv.ho_ten AS nguoi_tao_ho_ten
     FROM thong_bao tb
     LEFT JOIN nhan_vien nv ON nv.id = tb.nguoi_tao_id
     WHERE tb.nguoi_nhan_id = ?
        OR tb.nguoi_nhan_id IS NULL
     ORDER BY tb.created_at DESC
     LIMIT 15`,
    [employeeId]
  );

  return rows.map((r: any) => ({
    id: r.id,
    tieu_de: r.tieu_de,
    noi_dung: r.noi_dung,
    nguoi_tao: r.nguoi_tao_ho_ten || null,
    created_at: r.created_at,
  }));
}

async function alerts(role: VaiTro, managedDepartmentIds: number[]) {
  const notes: string[] = [];
  const { year, month } = getMonthRange();

  // Hợp đồng hết hạn
  const [expired]: any = await pool.query(
    `SELECT COUNT(*) AS c 
   FROM hop_dong 
   WHERE trang_thai = 'het_han'
     AND ngay_ket_thuc = CURDATE()`
  );
  if (Number(expired?.[0]?.c ?? 0) > 0) {
    notes.push(`Có ${expired[0].c} hợp đồng đã hết hạn.`);
  }

  // Hợp đồng sắp hết hạn 30 ngày
  const [soon]: any = await pool.query(
    `SELECT COUNT(*) AS c FROM hop_dong
     WHERE trang_thai = 'con_hieu_luc'
       AND ngay_ket_thuc IS NOT NULL
       AND ngay_ket_thuc BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)`
  );
  if (Number(soon?.[0]?.c ?? 0) > 0) {
    notes.push(`Có ${soon[0].c} hợp đồng sắp hết hạn trong ngày.`);
  }

  // Bảng lương chưa duyệt tháng này
  const [pay]: any = await pool.query(
    `SELECT COUNT(*) AS c FROM luong
     WHERE thang = ? AND nam = ? AND trang_thai_duyet = 'chua_duyet'`,
    [month, year]
  );
  if (Number(pay?.[0]?.c ?? 0) > 0) {
    notes.push(`Có ${pay[0].c} bảng lương chưa duyệt tháng này.`);
  }

  // Đơn nghỉ phép chờ duyệt cho manager
  if (role === "manager" && managedDepartmentIds?.length) {
    const placeholders = managedDepartmentIds.map(() => "?").join(",");
    const [pend]: any = await pool.query(
      `SELECT COUNT(*) AS c
       FROM don_nghi_phep d
       JOIN nhan_vien nv ON nv.id = d.nhan_vien_id
       WHERE d.trang_thai = 'cho_duyet'
         AND nv.phong_ban_id IN (${placeholders})`,
      managedDepartmentIds
    );
    if (Number(pend?.[0]?.c ?? 0) > 0) {
      notes.push(`Có ${pend[0].c} đơn nghỉ phép chờ duyệt.`);
    }
  }

  return notes;
}

// Đơn nghỉ phép đang chờ admin duyệt (manager gửi cho admin)
async function pendingLeaveForAdmin(adminEmployeeId: number | null) {
  if (!adminEmployeeId) return 0;

  const [rows]: any = await pool.query(
    `SELECT COUNT(*) AS c
     FROM don_nghi_phep
     WHERE trang_thai = 'cho_duyet'
       AND nguoi_duyet_id = ?`,
    [adminEmployeeId]
  );

  return Number(rows?.[0]?.c ?? 0);
}

export async function getCompleteDashboard(input: {
  accountId: number;
  phamvi: PhamVi;
}): Promise<DashboardResponse> {
  const { accountId, phamvi } = input;
  const role = phamvi.role;

  // với admin: ta vẫn gọi kpiManager để có OT (dùng toàn công ty),
  // nhưng pending_leave lấy từ pendingLeaveForAdmin
  const [kpiEmp, kpiMgrBase, kpiAdm, salary, rewards, top, qa, noti, alr, pendingAdmin] =
    await Promise.all([
      kpiEmployee(phamvi.employeeId),
      // dùng kpiManager cho cả admin & manager để lấy OT (cần managedDepartmentIds
      // nếu admin không có managedDepartmentIds, hàm sẽ trả pending=0, ot=0)
      kpiManager(phamvi.managedDepartmentIds || []),
      role === "admin" ? kpiAdmin() : Promise.resolve(null),
      salaryByDepartment(),
      rewardsTotals(),
      topEmployees(),
      role === "manager" ? quickApprove(phamvi.managedDepartmentIds) : Promise.resolve([]),
      notificationsForEmployee(phamvi.employeeId),
      alerts(role, phamvi.managedDepartmentIds),
      // pending cho admin
      role === "admin" ? pendingLeaveForAdmin(phamvi.employeeId) : Promise.resolve(0),
    ]);

  let kpi_manager: DashboardResponse["kpi_manager"] = null;

  if (role === "manager") {
    // manager: dùng pending & ot theo phòng ban quản lý
    kpi_manager = kpiMgrBase;
  } else if (role === "admin") {
    // admin: pending lấy theo nguoi_duyet_id, OT dùng từ kpiMgrBase (hoặc 0 nếu không có managedDepartmentIds)
    kpi_manager = {
      pending_leave: pendingAdmin,
      ot: kpiMgrBase?.ot ?? 0,
    };
  }

  return {
    alerts: alr,
    kpi_employee: role === "employee" ? kpiEmp : null,
    kpi_manager,
    kpi_admin: role === "admin" ? kpiAdm : null,
    salary,
    rewards,
    topEmployees: top,
    quick_approve: role === "manager" ? qa : [],
    notifications: noti,
  };
}
