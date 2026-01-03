/**
 * Giao diện đại diện cho một bản ghi Chấm Công
 */
export interface ChamCong {
  id: number;
  nhan_vien_id: number; // FK -> nhan_vien.id
  ngay_lam: string; // yyyy-MM-dd
  gio_vao: string | null; // HH:mm:ss
  gio_ra: string | null; // HH:mm:ss
  // Trạng thái chấm công (di_lam là trạng thái chung, các trạng thái khác là biến thể)
  trang_thai: "di_lam" | "di_muon" | "ve_som" | "di_muon_ve_som" | "nghi_phep" | "vang_khong_phep"; // Thay thế cho nghỉ không phép
  // Loại ngày làm việc: Dùng cho việc tính toán hệ số lương/phụ cấp

  loai_ngay: "le" | "tet" | "lam_bu" | "thuong"; // ⬅️ TRƯỜNG MỚI

  ghi_chu: string | null;
  tong_gio: number; // Tổng số giờ làm thực tế (backend tính)
  gio_tang_ca: number; // Tổng số giờ tăng ca (backend tính, chỉ dùng để lưu trữ cho phân tích/báo cáo)
}
