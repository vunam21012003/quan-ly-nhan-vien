export interface NhanVien {
  id: number;
  ho_ten: string;
  gioi_tinh: "Nam" | "Nữ";
  ngay_sinh: string | null;
  dia_chi: string | null;
  so_dien_thoai: string | null;
  email: string | null;
  anh_dai_dien: string | null;
  phong_ban_id: number | null;
  chuc_vu_id: number | null;
  ngay_vao_lam: string | null;
  trang_thai: string;
  ghi_chu: string | null;
}
