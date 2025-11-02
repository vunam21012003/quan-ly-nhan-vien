export interface ChucVu {
  id: number;
  ten_chuc_vu: string;
  mo_ta: string | null;
  quyen_mac_dinh: "admin" | "manager" | "employee";
  muc_luong_co_ban: number;
  phong_ban_id: number | null; // FK đến phòng ban
  ten_phong_ban?: string | null; // Tên phòng ban (JOIN)
}
