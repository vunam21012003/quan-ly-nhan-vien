export interface TaiKhoan {
  id?: number;
  nhan_vien_id: number;
  chuc_vu_id?: number | null;
  trang_thai?: "active" | "inactive";
  ten_dang_nhap: string;
  mat_khau: string;
}
