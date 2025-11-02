// src/services/tongGioService.ts
import { capNhatPhanTichCong } from "./phanTichCongService";

/**
 * Alias tương thích ngược: thay vì cập nhật tong_gio_lam (đã xoá),
 * chúng ta gom về phan_tich_cong.
 */
export async function capNhatTongGioLam(nhan_vien_id: number, ngay_lam: string) {
  await capNhatPhanTichCong(nhan_vien_id, ngay_lam);
}
