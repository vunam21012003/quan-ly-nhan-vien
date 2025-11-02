// src/models/hopDong.ts
export interface HopDong {
  id: number;
  nhan_vien_id: number;
  loai_hop_dong: "Thử việc" | "Xác định thời hạn" | "Không xác định thời hạn";
  ngay_bat_dau: string;
  ngay_ket_thuc: string | null;
  luong_thoa_thuan: number; // P1: lương vị trí
  // ==== P2: phụ cấp năng lực, trách nhiệm, thâm niên, cố định ====
  phu_cap_co_dinh: number;
  phu_cap_tham_nien: number;
  phu_cap_nang_luc: number;
  phu_cap_trach_nhiem: number;

  trang_thai: "con_hieu_luc" | "het_han" | "da_cham_dut";
  file_hop_dong: string | null;
  ghi_chu: string | null;
  so_hop_dong: string | null;
  ngay_ky: string | null;
}
