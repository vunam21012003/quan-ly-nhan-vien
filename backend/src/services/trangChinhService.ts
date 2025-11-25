// src/services/trangChinhService.ts
import { pool } from "../db";
import {
  StaffSummary,
  SalaryByDepartment,
  HoursSummary,
  RewardsSummary,
  HolidayItem,
  DashboardResponse,
} from "../models/trangChinh";
import { PhepPhamVi } from "../utils/pham-vi-nguoi-dung";

export const dashboardService = {
  // ============================================
  // 1) Tổng quan nhân sự + chấm công hôm nay
  // ============================================
  async getStaffSummary(phamvi: PhepPhamVi): Promise<StaffSummary> {
    const { role, employeeId, managedDepartmentIds } = phamvi;

    // -------------------------------
    // 🟢 EMPLOYEE → chỉ xem của chính mình
    // -------------------------------
    if (role === "employee") {
      const today = new Date().toISOString().slice(0, 10);

      const [[cc]]: any = await pool.query(
        `
        SELECT trang_thai
        FROM cham_cong
        WHERE ngay_lam = ? AND nhan_vien_id = ?
        LIMIT 1
      `,
        [today, employeeId]
      );

      const present = cc?.trang_thai?.startsWith("di") ? 1 : 0;
      const leave = cc?.trang_thai === "nghi_phep" ? 1 : 0;
      const unlawful = cc?.trang_thai === "nghi_khong_phep" ? 1 : 0;
      const absent = cc ? 0 : 1;

      return {
        total: 1,
        active: 1,
        present,
        leave,
        unlawful,
        absent,
        by_department: [],
      };
    }

    // -------------------------------
    // 🔵 MANAGER → chỉ xem các phòng ban mình quản lý
    // -------------------------------
    if (role === "manager") {
      if (!managedDepartmentIds.length) {
        return {
          total: 0,
          active: 0,
          present: 0,
          leave: 0,
          unlawful: 0,
          absent: 0,
          by_department: [],
        };
      }

      const today = new Date().toISOString().slice(0, 10);
      const placeholders = managedDepartmentIds.map(() => "?").join(",");

      const params: any[] = [today, ...managedDepartmentIds];

      const [rows]: any = await pool.query(
        `
        SELECT 
          pb.id AS phong_ban_id,
          pb.ten_phong_ban,
          COUNT(nv.id) AS total_staff,
          0 AS avg_salary,
          SUM(cc.trang_thai IN ('di_lam','di_muon','ve_som','di_muon_ve_som')) AS present,
          SUM(cc.trang_thai = 'nghi_phep') AS leave_count,
          SUM(cc.trang_thai = 'nghi_khong_phep') AS unlawful,
          SUM(cc.trang_thai IS NULL) AS absent
        FROM phong_ban pb
        LEFT JOIN nhan_vien nv ON nv.phong_ban_id = pb.id
        LEFT JOIN cham_cong cc 
          ON cc.nhan_vien_id = nv.id
         AND cc.ngay_lam = ?
        WHERE pb.id IN (${placeholders})
        GROUP BY pb.id, pb.ten_phong_ban
      `,
        params
      );

      let total = 0;
      let present = 0;
      let leave = 0;
      let unlawful = 0;
      let absent = 0;

      rows.forEach((r: any) => {
        total += r.total_staff;
        present += r.present;
        leave += r.leave_count;
        unlawful += r.unlawful;
        absent += r.absent;
      });

      return {
        total,
        active: total,
        present,
        leave,
        unlawful,
        absent,
        by_department: rows,
      };
    }

    // -------------------------------
    // 🔴 ADMIN → full công ty
    // -------------------------------
    return this._staffSummaryCompany();
  },

  // Tổng quan công ty cho admin
  async _staffSummaryCompany(): Promise<StaffSummary> {
    const [[nv]]: any = await pool.query(
      "SELECT COUNT(*) AS total FROM nhan_vien WHERE trang_thai = 'dang_lam'"
    );

    const today = new Date().toISOString().slice(0, 10);

    const [[cc]]: any = await pool.query(
      `
      SELECT 
        COUNT(CASE WHEN trang_thai LIKE 'di%' THEN 1 END) AS present,
        COUNT(CASE WHEN trang_thai = 'nghi_phep' THEN 1 END) AS on_leave,
        COUNT(CASE WHEN trang_thai = 'nghi_khong_phep' THEN 1 END) AS unlawful
      FROM cham_cong
      WHERE ngay_lam = ?
    `,
      [today]
    );

    const [dept]: any = await pool.query(`
      SELECT 
        pb.id AS phong_ban_id,
        pb.ten_phong_ban,
        COUNT(nv.id) AS total_staff,
        COALESCE(AVG(hd.luong_thoa_thuan), 0) AS avg_salary
      FROM phong_ban pb
      LEFT JOIN nhan_vien nv ON nv.phong_ban_id = pb.id
      LEFT JOIN hop_dong hd 
        ON hd.nhan_vien_id = nv.id 
       AND hd.trang_thai = 'con_hieu_luc'
      GROUP BY pb.id, pb.ten_phong_ban
    `);

    return {
      total: nv.total,
      active: nv.total,
      present: cc.present || 0,
      leave: cc.on_leave || 0,
      unlawful: cc.unlawful || 0,
      absent: nv.total - (cc.present || 0),
      by_department: dept,
    };
  },

  // ============================================
  // 2) Lương tháng trước theo phòng ban
  // ============================================
  async getSalaryByDepartment(phamvi: PhepPhamVi): Promise<SalaryByDepartment> {
    const { role, employeeId, managedDepartmentIds } = phamvi;

    const now = new Date();
    let month = now.getMonth(); // 0-11 → tháng trước
    let year = now.getFullYear();

    if (month === 0) {
      month = 12;
      year -= 1;
    }

    // EMPLOYEE → chỉ lương của chính mình
    if (role === "employee") {
      const [rows]: any = await pool.query(
        `
        SELECT 
          pb.id AS phong_ban_id,
          pb.ten_phong_ban,
          l.luong_thuc_nhan AS total_salary,
          l.luong_thuc_nhan AS avg_salary,
          1 AS employee_count
        FROM nhan_vien nv
        LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
        LEFT JOIN luong l 
          ON l.nhan_vien_id = nv.id 
         AND l.thang = ? 
         AND l.nam = ?
        WHERE nv.id = ?
      `,
        [month, year, employeeId]
      );

      const total = rows[0]?.total_salary || 0;

      return {
        current_total: total,
        by_department: rows,
      };
    }

    // MANAGER → chỉ phòng ban mình quản lý
    if (role === "manager") {
      if (!managedDepartmentIds.length) {
        return {
          current_total: 0,
          by_department: [],
        };
      }

      const placeholders = managedDepartmentIds.map(() => "?").join(",");
      const params: any[] = [month, year, ...managedDepartmentIds];

      const [rows]: any = await pool.query(
        `
        SELECT 
          pb.id AS phong_ban_id,
          pb.ten_phong_ban,
          SUM(l.luong_thuc_nhan) AS total_salary,
          AVG(l.luong_thuc_nhan) AS avg_salary,
          COUNT(l.id) AS employee_count
        FROM phong_ban pb
        LEFT JOIN nhan_vien nv ON nv.phong_ban_id = pb.id
        LEFT JOIN luong l 
          ON l.nhan_vien_id = nv.id 
         AND l.thang = ? 
         AND l.nam = ?
        WHERE pb.id IN (${placeholders})
        GROUP BY pb.id, pb.ten_phong_ban
      `,
        params
      );

      const total = rows.reduce((sum: number, r: any) => sum + (r.total_salary || 0), 0);

      return {
        current_total: total,
        by_department: rows,
      };
    }

    // ADMIN → full công ty
    return this._salaryByCompany(month, year);
  },

  async _salaryByCompany(month: number, year: number): Promise<SalaryByDepartment> {
    const [rows]: any = await pool.query(
      `
      SELECT 
        pb.id AS phong_ban_id,
        pb.ten_phong_ban,
        SUM(l.luong_thuc_nhan) AS total_salary,
        AVG(l.luong_thuc_nhan) AS avg_salary,
        COUNT(l.id) AS employee_count
      FROM phong_ban pb
      LEFT JOIN nhan_vien nv ON nv.phong_ban_id = pb.id
      LEFT JOIN luong l 
        ON l.nhan_vien_id = nv.id 
       AND l.thang = ? 
       AND l.nam = ?
      GROUP BY pb.id, pb.ten_phong_ban
      ORDER BY total_salary DESC
    `,
      [month, year]
    );

    const current_total = rows.reduce((sum: number, r: any) => sum + (r.total_salary || 0), 0);

    return {
      current_total,
      by_department: rows,
    };
  },

  // ============================================
  // 3) Tổng giờ làm tháng này (role-based)
  // ============================================
  async getHoursSummary(phamvi: PhepPhamVi): Promise<HoursSummary> {
    const { role, employeeId, managedDepartmentIds } = phamvi;

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // EMPLOYEE → chỉ giờ của chính mình
    if (role === "employee") {
      const [[row]]: any = await pool.query(
        `
        SELECT 
          SUM(tong_gio) AS total_hours,
          AVG(tong_gio) AS avg_hours_per_employee,
          0 AS overtime_hours
        FROM cham_cong
        WHERE nhan_vien_id = ? 
          AND MONTH(ngay_lam) = ? 
          AND YEAR(ngay_lam) = ?
      `,
        [employeeId, month, year]
      );

      return {
        current_month: month,
        current_year: year,
        total_hours: row?.total_hours || 0,
        avg_hours_per_employee: row?.avg_hours_per_employee || 0,
        overtime_hours: row?.overtime_hours || 0,
      };
    }

    // MANAGER → nhân viên thuộc các phòng ban mình quản lý
    if (role === "manager") {
      if (!managedDepartmentIds.length) {
        return {
          current_month: month,
          current_year: year,
          total_hours: 0,
          avg_hours_per_employee: 0,
          overtime_hours: 0,
        };
      }

      const placeholders = managedDepartmentIds.map(() => "?").join(",");
      const params: any[] = [...managedDepartmentIds, month, year];

      const [[row]]: any = await pool.query(
        `
        SELECT 
          SUM(cc.tong_gio) AS total_hours,
          AVG(cc.tong_gio) AS avg_hours_per_employee,
          0 AS overtime_hours
        FROM cham_cong cc
        JOIN nhan_vien nv ON nv.id = cc.nhan_vien_id
        WHERE nv.phong_ban_id IN (${placeholders})
          AND MONTH(cc.ngay_lam) = ?
          AND YEAR(cc.ngay_lam) = ?
      `,
        params
      );

      return {
        current_month: month,
        current_year: year,
        total_hours: row?.total_hours || 0,
        avg_hours_per_employee: row?.avg_hours_per_employee || 0,
        overtime_hours: row?.overtime_hours || 0,
      };
    }

    // ADMIN → toàn công ty
    const [[row]]: any = await pool.query(
      `
      SELECT 
        SUM(tong_gio) AS total_hours,
        AVG(tong_gio) AS avg_hours_per_employee,
        0 AS overtime_hours
      FROM cham_cong
      WHERE MONTH(ngay_lam)=? AND YEAR(ngay_lam)=?
    `,
      [month, year]
    );

    return {
      current_month: month,
      current_year: year,
      total_hours: row?.total_hours || 0,
      avg_hours_per_employee: row?.avg_hours_per_employee || 0,
      overtime_hours: row?.overtime_hours || 0,
    };
  },

  // ============================================
  // 4) Thưởng + Phạt (role-based)
  // ============================================
  async getRewardsSummary(phamvi: PhepPhamVi): Promise<RewardsSummary> {
    const { role, employeeId, managedDepartmentIds } = phamvi;
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Định nghĩa Giờ làm chuẩn và Đơn giá quy đổi
    const STANDARD_HOURS_PER_DAY = 8;
    const OVERTIME_RATE_PER_HOUR = 10000;

    // Chuỗi tính toán Điểm Đóng Góp Ròng (Net Contribution Score)
    const NET_CONTRIBUTION_SCORE_FORMULA = `
        (
            SUM(CASE WHEN cc.tong_gio > ${STANDARD_HOURS_PER_DAY} THEN cc.tong_gio - ${STANDARD_HOURS_PER_DAY} ELSE 0 END) * ${OVERTIME_RATE_PER_HOUR} 
            + 
            SUM(CASE WHEN tp.loai='THUONG' THEN tp.so_tien ELSE 0 END) 
            - 
            SUM(CASE WHEN tp.loai='PHAT' THEN tp.so_tien ELSE 0 END)
        )
    `;

    // ========== EMPLOYEE ==========
    if (role === "employee") {
      const [[sum]]: any = await pool.query(
        `
            SELECT 
              SUM(CASE WHEN loai='THUONG' THEN so_tien ELSE 0 END) AS reward_total,
              SUM(CASE WHEN loai='PHAT' THEN so_tien ELSE 0 END) AS punishment_total,
              COUNT(CASE WHEN loai='THUONG' THEN 1 END) AS rewards,
              COUNT(CASE WHEN loai='PHAT' THEN 1 END) AS punishments
            FROM thuong_phat
            WHERE thang = ? AND nam = ? AND nhan_vien_id = ?
          `,
        [month, year, employeeId]
      );

      const [detail]: any = await pool.query(
        `
            SELECT 
              nv.id AS nhan_vien_id,
              nv.ho_ten,
              pb.ten_phong_ban,
              SUM(CASE WHEN tp.loai='THUONG' THEN tp.so_tien ELSE 0 END) AS reward_total,
              SUM(CASE WHEN tp.loai='PHAT' THEN tp.so_tien ELSE 0 END) AS punishment_total,
              SUM(cc.tong_gio) AS total_hours,
              ${NET_CONTRIBUTION_SCORE_FORMULA} AS net_contribution_score
            FROM nhan_vien nv
            LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
            LEFT JOIN thuong_phat tp 
              ON tp.nhan_vien_id = nv.id 
              AND tp.thang = ? AND tp.nam = ?
            LEFT JOIN cham_cong cc 
              ON cc.nhan_vien_id = nv.id
              AND MONTH(cc.ngay_lam) = ? AND YEAR(cc.ngay_lam) = ?
            WHERE nv.id = ?
            GROUP BY nv.id, nv.ho_ten, pb.ten_phong_ban
          `,
        [month, year, month, year, employeeId]
      );

      return {
        rewards: sum?.rewards || 0,
        punishments: sum?.punishments || 0,
        reward_total: sum?.reward_total || 0,
        punishment_total: sum?.punishment_total || 0,
        by_employee: detail || [],
      };
    }

    // ========== MANAGER ==========
    if (role === "manager") {
      if (!managedDepartmentIds.length) {
        return {
          rewards: 0,
          punishments: 0,
          reward_total: 0,
          punishment_total: 0,
          by_employee: [],
        };
      }

      const placeholders = managedDepartmentIds.map(() => "?").join(",");
      const baseParams: any[] = [...managedDepartmentIds, month, year];

      // Tổng theo phòng ban manager quản lý
      const [[sum]]: any = await pool.query(
        `
            SELECT 
              SUM(CASE WHEN tp.loai='THUONG' THEN tp.so_tien ELSE 0 END) AS reward_total,
              SUM(CASE WHEN tp.loai='PHAT' THEN tp.so_tien ELSE 0 END) AS punishment_total,
              COUNT(CASE WHEN tp.loai='THUONG' THEN 1 END) AS rewards,
              COUNT(CASE WHEN tp.loai='PHAT' THEN 1 END) AS punishments
            FROM thuong_phat tp
            JOIN nhan_vien nv ON nv.id = tp.nhan_vien_id
            WHERE nv.phong_ban_id IN (${placeholders})
              AND tp.thang = ? AND tp.nam = ?
          `,
        baseParams
      );

      // Chi tiết theo nhân viên
      const detailParams: any[] = [month, year, month, year, ...managedDepartmentIds];

      const [detail]: any = await pool.query(
        `
            SELECT
              nv.id AS nhan_vien_id,
              nv.ho_ten,
              pb.ten_phong_ban,
              SUM(CASE WHEN tp.loai='THUONG' THEN tp.so_tien ELSE 0 END) AS reward_total,
              SUM(CASE WHEN tp.loai='PHAT' THEN tp.so_tien ELSE 0 END) AS punishment_total,
              SUM(cc.tong_gio) AS total_hours,
              ${NET_CONTRIBUTION_SCORE_FORMULA} AS net_contribution_score
            FROM nhan_vien nv
            LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
            LEFT JOIN thuong_phat tp 
              ON tp.nhan_vien_id = nv.id 
              AND tp.thang = ? AND tp.nam = ?
            LEFT JOIN cham_cong cc 
              ON cc.nhan_vien_id = nv.id
              AND MONTH(cc.ngay_lam) = ? AND YEAR(cc.ngay_lam) = ?
            WHERE nv.phong_ban_id IN (${placeholders})
            GROUP BY nv.id, nv.ho_ten, pb.ten_phong_ban
            ORDER BY net_contribution_score DESC
            LIMIT 10
          `,
        detailParams
      );

      return {
        rewards: sum?.rewards || 0,
        punishments: sum?.punishments || 0,
        reward_total: sum?.reward_total || 0,
        punishment_total: sum?.punishment_total || 0,
        by_employee: detail || [],
      };
    }

    // ========== ADMIN ==========
    const [[sum]]: any = await pool.query(
      `
        SELECT 
          SUM(CASE WHEN loai='THUONG' THEN so_tien ELSE 0 END) AS reward_total,
          SUM(CASE WHEN loai='PHAT' THEN so_tien ELSE 0 END) AS punishment_total,
          COUNT(CASE WHEN loai='THUONG' THEN 1 END) AS rewards,
          COUNT(CASE WHEN loai='PHAT' THEN 1 END) AS punishments
        FROM thuong_phat
        WHERE thang = ? AND nam = ?
      `,
      [month, year]
    );

    const [detail]: any = await pool.query(
      `
        SELECT 
          nv.id AS nhan_vien_id,
          nv.ho_ten,
          pb.ten_phong_ban,
          SUM(CASE WHEN tp.loai='THUONG' THEN tp.so_tien ELSE 0 END) AS reward_total,
          SUM(CASE WHEN tp.loai='PHAT' THEN tp.so_tien ELSE 0 END) AS punishment_total,
          SUM(cc.tong_gio) AS total_hours,
          ${NET_CONTRIBUTION_SCORE_FORMULA} AS net_contribution_score
        FROM nhan_vien nv
        LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
        LEFT JOIN thuong_phat tp 
          ON tp.nhan_vien_id = nv.id 
          AND tp.thang = ? AND tp.nam = ?
        LEFT JOIN cham_cong cc 
          ON cc.nhan_vien_id = nv.id
          AND MONTH(cc.ngay_lam) = ? AND YEAR(cc.ngay_lam) = ?
        GROUP BY nv.id, nv.ho_ten, pb.ten_phong_ban
        ORDER BY net_contribution_score DESC
        LIMIT 10
      `,
      [month, year, month, year]
    );

    return {
      rewards: sum?.rewards || 0,
      punishments: sum?.punishments || 0,
      reward_total: sum?.reward_total || 0,
      punishment_total: sum?.punishment_total || 0,
      by_employee: detail || [],
    };
  },

  // ============================================
  // 5) Ngày lễ (ai cũng xem được)
  // ============================================
  async getUpcomingHolidays(): Promise<HolidayItem[]> {
    const today = new Date().toISOString().slice(0, 10);

    const [rows]: any = await pool.query(
      `
      SELECT id, ngay, ten_ngay, loai, mo_ta, so_ngay_nghi
      FROM ngay_le
      WHERE ngay >= ?
      ORDER BY ngay ASC
      LIMIT 5
    `,
      [today]
    );

    return rows;
  },

  // ============================================
  // 6) Dữ liệu hoàn chỉnh Dashboard (role-based)
  // ============================================
  async getCompleteDashboardData(phamvi: PhepPhamVi): Promise<DashboardResponse> {
    const [staff, salary, hours, holidays, rewards] = await Promise.all([
      this.getStaffSummary(phamvi),
      this.getSalaryByDepartment(phamvi),
      this.getHoursSummary(phamvi),
      this.getUpcomingHolidays(),
      this.getRewardsSummary(phamvi),
    ]);

    return {
      staff,
      salary,
      hours,
      holidays,
      rewards,
    };
  },
};
