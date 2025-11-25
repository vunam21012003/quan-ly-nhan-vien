// src/models/hopDong.ts
export interface HopDong {
  id: number;
  nhan_vien_id: number;
  loai_hop_dong: "Thử việc" | "Xác định thời hạn" | "Không xác định thời hạn";
  ngay_bat_dau: string;
  ngay_ket_thuc: string | null;
  luong_thoa_thuan: number; // P1: lương vị trí

  // Không còn lưu chi tiết phụ cấp ở đây nữa
  // Phụ cấp cố định sẽ nằm trong bảng phu_cap_chi_tiet (theo hop_dong_id)

  trang_thai: "con_hieu_luc" | "het_han" | "da_cham_dut";
  file_hop_dong: string | null;
  ghi_chu: string | null;
  so_hop_dong: string | null;
  ngay_ky: string | null;
  tong_phu_cap?: number; // tổng phụ cấp cố định (từ join bảng phu_cap_chi_tiet)
}
