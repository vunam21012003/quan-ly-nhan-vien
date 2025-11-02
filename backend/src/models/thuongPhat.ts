// src/models/thuongPhat.ts
export interface ThuongPhat {
  id: number;
  nhan_vien_id: number;
  phong_ban_id?: number;
  thang: number;
  nam: number;
  loai: "THUONG" | "PHAT";
  ly_do?: string;
  so_tien: number;
  ghi_chu?: string;
  nguoi_tao_id?: number;
  ngay_tao?: string;
}
