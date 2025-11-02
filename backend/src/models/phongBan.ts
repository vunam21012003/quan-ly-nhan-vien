export interface PhongBan {
  id: number;
  ten_phong_ban: string;
  mo_ta: string | null;
  manager_taikhoan_id: number | null; // FK đến tài khoản trưởng phòng
}

// constructor({ id, ten, mo_ta, manager_taikhoan_id, manager_name }: any) {
//   this.id = id;
//   this.ten = ten;
//   this.mo_ta = mo_ta ?? null;
//   this.manager_taikhoan_id = manager_taikhoan_id ?? null;
//   this.manager_name = manager_name ?? null;
// }
