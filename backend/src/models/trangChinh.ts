// src/models/Dashboard.ts

export interface StaffSummary {
  total: number;
  active: number;
  present: number;
  absent: number;
  leave: number;
  unlawful: number;
  by_department: DepartmentStaff[];
}

export interface DepartmentStaff {
  phong_ban_id: number;
  ten_phong_ban: string;
  total_staff: number;
  avg_salary: number;
  present?: number;
  absent?: number;
}

export interface SalaryByDepartment {
  current_total: number;
  by_department: DepartmentSalary[];
}

export interface DepartmentSalary {
  phong_ban_id: number;
  ten_phong_ban: string;
  total_salary: number;
  avg_salary: number;
  employee_count: number;
}

export interface HoursSummary {
  current_month: number;
  current_year: number;
  total_hours: number;
  avg_hours_per_employee: number;
  overtime_hours: number;
}

export interface RewardsSummary {
  rewards: number;
  punishments: number;
  reward_total: number;
  punishment_total: number;
  by_employee: EmployeePerformance[];
}

export interface EmployeePerformance {
  nhan_vien_id: number;
  ho_ten: string;
  ten_phong_ban: string;
  reward_total: number;
  punishment_total: number;
  total_hours: number;
  performance_score?: number;
}

export interface HolidayItem {
  id: number;
  ngay: string;
  ten_ngay: string;
  loai: "le" | "tet" | "cuoi_tuan" | "lam_bu";
  mo_ta?: string;
  so_ngay_nghi: number;
}

export interface DashboardResponse {
  staff: StaffSummary;
  salary: SalaryByDepartment;
  hours: HoursSummary;
  holidays: HolidayItem[];
  rewards: RewardsSummary;
}

export interface AttendanceStats {
  loai: string;
  so_luong: number;
  ty_le: number;
}

export interface RewardStats {
  loai: string;
  so_nguoi: number;
  tong_tien: number;
}

export interface EmployeeAttendance {
  nhan_vien_id: number;
  ho_ten: string;
  ngay_lam: string;
  trang_thai: string;
  gio_vao?: string;
  gio_ra?: string;
}
