// // src/services/tinhLuongService.ts
// import { pool } from "../db";

// /**
//  * Hàm tính lương theo mô hình 3P cho toàn bộ nhân viên trong tháng/năm
//  * - P1: Lương cơ bản theo vị trí
//  * - P2: Phụ cấp năng lực, trách nhiệm, thâm niên, cố định
//  * - P3: Hiệu suất, tăng ca, thưởng/phạt
//  */
// export async function tinhLuongThang(thang: number, nam: number, req?: any) {
//   console.log(`🔹 Bắt đầu tính lương tháng ${thang}/${nam}...`);

//   // 1️⃣ Lấy danh sách hợp đồng còn hiệu lực trong kỳ
//   const [hopDongs]: any = await pool.query(
//     `
//     SELECT
//       hd.nhan_vien_id,
//       nv.ho_ten,
//       hd.luong_thoa_thuan,
//       hd.phu_cap_nang_luc,
//       hd.phu_cap_trach_nhiem,
//       hd.phu_cap_tham_nien,
//       hd.phu_cap_co_dinh
//     FROM hop_dong hd
//     JOIN nhan_vien nv ON nv.id = hd.nhan_vien_id
//     WHERE hd.trang_thai = 'con_hieu_luc'
//     `
//   );

//   if (!hopDongs.length) {
//     return { totalNhanVien: 0, summary: [], message: "Không có hợp đồng còn hiệu lực" };
//   }

//   let summary: any[] = [];

//   // Xoá dữ liệu lương cũ của kỳ này để ghi lại
//   await pool.query(`DELETE FROM luong WHERE thang = ? AND nam = ?`, [thang, nam]);

//   // 2️⃣ Duyệt từng nhân viên để tính lương
//   for (const hd of hopDongs) {
//     const nhan_vien_id = hd.nhan_vien_id;

//     // --- Lấy dữ liệu phân tích công (P3) ---
//     const [[ptc]]: any = await pool.query(
//       `
//       SELECT
//         tong_gio,
//         gio_tang_ca,
//         so_ngay_cong,
//         so_ngay_nghi_phep,
//         so_ngay_nghi_khong_phep
//       FROM phan_tich_cong
//       WHERE nhan_vien_id = ? AND thang = ? AND nam = ?
//       `,
//       [nhan_vien_id, thang, nam]
//     );

//     // --- Lấy thưởng / phạt ---
//     const [[thuongPhat]]: any = await pool.query(
//       `
//       SELECT
//         COALESCE(SUM(CASE WHEN loai='THUONG' THEN so_tien ELSE 0 END),0) AS tong_thuong,
//         COALESCE(SUM(CASE WHEN loai='PHAT' THEN so_tien ELSE 0 END),0) AS tong_phat
//       FROM thuong_phat
//       WHERE nhan_vien_id = ? AND thang = ? AND nam = ?
//       `,
//       [nhan_vien_id, thang, nam]
//     );

//     const tong_thuong = thuongPhat?.tong_thuong || 0;
//     const tong_phat = thuongPhat?.tong_phat || 0;

//     const tong_gio = ptc?.tong_gio || 0;
//     const gio_tang_ca = ptc?.gio_tang_ca || 0;
//     const so_ngay_cong = ptc?.so_ngay_cong || 0;
//     const so_ngay_nghi_phep = ptc?.so_ngay_nghi_phep || 0;
//     const so_ngay_nghi_khong_phep = ptc?.so_ngay_nghi_khong_phep || 0;

//     // --- Tính lương theo mô hình 3P ---
//     const luong_thoa_thuan = hd.luong_thoa_thuan || 0;
//     const luong_gio = luong_thoa_thuan / 26 / 8; // trung bình 26 ngày * 8h
//     const he_so_tang_ca = 1.5; // giờ tăng ca = 150% lương giờ

//     // P1 = lương thỏa thuận * (số ngày công / 26)
//     const luong_p1 = luong_thoa_thuan * (so_ngay_cong / 26) || 0;

//     // P2 = tổng phụ cấp
//     const luong_p2 =
//       (hd.phu_cap_nang_luc || 0) +
//       (hd.phu_cap_trach_nhiem || 0) +
//       (hd.phu_cap_tham_nien || 0) +
//       (hd.phu_cap_co_dinh || 0);

//     // P3 = giờ tăng ca * hệ số + thưởng - phạt
//     const luong_tang_ca = gio_tang_ca * luong_gio * he_so_tang_ca;
//     const luong_p3 = luong_tang_ca + tong_thuong - tong_phat;

//     // Tổng lương
//     const tong_luong = luong_p1 + luong_p2 + luong_p3;

//     // --- Các khoản trừ (bảo hiểm, thuế TNCN) ---
//     const bhxh = tong_luong * 0.08;
//     const bhyt = tong_luong * 0.015;
//     const bhtn = tong_luong * 0.01;
//     const tong_bh = bhxh + bhyt + bhtn;
//     const thue_tncn = tong_luong > 11000000 ? (tong_luong - 11000000) * 0.05 : 0;

//     const luong_thuc_nhan = tong_luong - tong_bh - thue_tncn;

//     // --- Ghi vào bảng lương ---
//     await pool.query(
//       `
//       INSERT INTO luong
//       (nhan_vien_id, thang, nam, luong_p1, luong_p2, luong_p3, so_ngay_cong,
//        so_ngay_nghi_phep, so_ngay_nghi_khong_phep, gio_tang_ca, tong_luong,
//        bhxh, bhyt, bhtn, thue_tncn, luong_thuc_nhan, ngay_tinh)
//       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//       `,
//       [
//         nhan_vien_id,
//         thang,
//         nam,
//         luong_p1,
//         luong_p2,
//         luong_p3,
//         so_ngay_cong,
//         so_ngay_nghi_phep,
//         so_ngay_nghi_khong_phep,
//         gio_tang_ca,
//         tong_luong,
//         bhxh,
//         bhyt,
//         bhtn,
//         thue_tncn,
//         luong_thuc_nhan,
//       ]
//     );

//     summary.push({
//       nhan_vien_id,
//       ho_ten: hd.ho_ten,
//       P1: luong_p1,
//       P2: luong_p2,
//       P3: luong_p3,
//       tong_luong,
//       thue_tncn,
//       luong_thuc_nhan,
//     });
//   }

//   console.log(`✅ Đã tính xong lương tháng ${thang}/${nam} cho ${hopDongs.length} nhân viên.`);
//   return { totalNhanVien: hopDongs.length, summary };
// }
