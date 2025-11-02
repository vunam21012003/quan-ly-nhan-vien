export interface Luong {
  id: number;
  nhan_vien_id: number;

  // Lương thỏa thuận và các phần lương khác
  luong_thoa_thuan: number;
  luong_p2: number;
  luong_p3: number;
  phu_cap: number;

  // Thời gian tính lương
  thang: number;
  nam: number;
  ngay_tinh: string; // dạng 'YYYY-MM-DD'

  // Công & giờ làm
  ngay_cong: number;
  ngay_cong_lam: number;
  so_ngay_le: number;
  gio_tang_ca: number;

  // Tổng hợp lương & khấu trừ
  tong_luong: number;
  bhxh: number;
  bhyt: number;
  bhtn: number;
  tong_bh: number;
  thue_tncn: number;
  luong_thuc_nhan: number;
}
