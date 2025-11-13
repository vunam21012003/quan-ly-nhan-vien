import { pool } from "../db";

// Thống kê cho Admin/Manager
export const getAdminManagerStats = async () => {
  // 1. Tổng nhân viên
  const [[totalEmployees]]: any = await pool.query("SELECT COUNT(id) AS c FROM nhan_vien");

  // 2. Yêu cầu cần duyệt (Ví dụ: Yêu cầu nghỉ phép có trạng thái 'Pending')
  const [[pendingRequests]]: any = await pool.query(
    "SELECT COUNT(id) AS c FROM yeu_cau_nghi_phep WHERE trang_thai = 'Pending'"
  );

  // 3. NV Vắng mặt hôm nay (Cần logic phức tạp hơn, đây là ví dụ đơn giản)
  // Giả sử có bảng chấm công và xác định người chưa chấm công / đang nghỉ phép
  const absentToday = 0; // Để đơn giản, giả lập = 0

  return {
    totalEmployees: totalEmployees?.c || 0,
    pendingRequests: pendingRequests?.c || 0,
    absentToday: absentToday,
  };
};

// Thống kê cá nhân cho Employee
export const getEmployeeStats = async (nhanVienId: number) => {
  // 1. Số ngày phép còn lại (Giả định có bảng thong_tin_phep)
  const [[leaveInfo]]: any = await pool.query(
    "SELECT so_ngay_phep_con_lai FROM thong_tin_phep WHERE nhan_vien_id = ?",
    [nhanVienId]
  );

  // 2. Bảng lương kỳ gần nhất (Giả định lấy cột luong_thuc_nhan từ bảng bang_luong)
  const [[lastSalary]]: any = await pool.query(
    "SELECT luong_thuc_nhan FROM bang_luong WHERE nhan_vien_id = ? ORDER BY thang DESC LIMIT 1",
    [nhanVienId]
  );

  return {
    remainingLeaveDays: leaveInfo?.so_ngay_phep_con_lai || 0,
    lastSalaryAmount: lastSalary?.luong_thuc_nhan.toLocaleString("vi-VN") || "Chưa có",
  };
};
