export interface ChamCong {
  id: number;
  nhan_vien_id: number; // FK -> nhan_vien.id
  ngay_lam: string; // yyyy-MM-dd
  gio_vao: string | null; // HH:mm:ss
  gio_ra: string | null; // HH:mm:ss
  trang_thai:
    | "di_lam"
    | "di_muon"
    | "di_muon_co_phep"
    | "ve_som"
    | "ve_som_co_phep"
    | "di_muon_ve_som"
    | "nghi_phep"
    | "nghi_khong_phep"
    | "ngay_le";
  ghi_chu: string | null;
  tong_gio: number; // Tổng số giờ làm trong ngày (tự tính backend)
}
