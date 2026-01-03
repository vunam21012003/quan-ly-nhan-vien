import { pool } from "../db";
import { tao as taoThongBao } from "../services/thongBaoService";

export async function xuLyHopDongTuDong() {
  console.log("🔄 [CRON] Bắt đầu kiểm tra hợp đồng...");

  try {
    // ===================================================================
    // BƯỚC 0: Lấy danh sách Admin/HR để nhận thông báo (Dùng chung)
    // ===================================================================
    const [admins]: any = await pool.query(`
        SELECT nv.id 
        FROM nhan_vien nv
        JOIN chuc_vu cv ON nv.chuc_vu_id = cv.id
        WHERE (cv.ten_chuc_vu LIKE '%Admin%' OR cv.ten_chuc_vu LIKE '%Giám đốc%' OR cv.ten_chuc_vu LIKE '%Nhân sự%')
        AND nv.trang_thai = 'dang_lam'
    `);

    // ===================================================================
    // TRƯỜNG HỢP 1: CẢNH BÁO SỚM (Còn đúng 30 ngày nữa hết hạn)
    // Logic: Chỉ gửi thông báo, KHÔNG đổi trạng thái
    // ===================================================================
    const SO_NGAY_BAO_TRUOC = 30;

    const [upcomingList]: any = await pool.query(
      `
        SELECT hd.id, hd.nhan_vien_id, hd.so_hop_dong, nv.ho_ten,
               DATE_FORMAT(hd.ngay_ket_thuc, '%d/%m/%Y') as ngay_ket_thuc_fmt
        FROM hop_dong hd
        JOIN nhan_vien nv ON hd.nhan_vien_id = nv.id
        WHERE hd.trang_thai = 'con_hieu_luc'
          -- Chỉ lấy đúng ngày khớp mốc 30 ngày
          AND hd.ngay_ket_thuc = DATE_ADD(CURDATE(), INTERVAL ? DAY)
    `,
      [SO_NGAY_BAO_TRUOC]
    );

    if (upcomingList.length > 0) {
      console.log(
        `🔔 Tìm thấy ${upcomingList.length} hợp đồng sắp hết hạn sau ${SO_NGAY_BAO_TRUOC} ngày.`
      );

      for (const hd of upcomingList) {
        const tieuDe = `Sắp hết hạn HĐ: ${hd.so_hop_dong}`;
        const noiDungNv = `Hợp đồng số ${hd.so_hop_dong} sẽ hết hạn vào ngày ${hd.ngay_ket_thuc_fmt} (Còn ${SO_NGAY_BAO_TRUOC} ngày).`;
        const noiDungAd = `Hợp đồng của ${hd.ho_ten} sắp hết hạn ngày ${hd.ngay_ket_thuc_fmt}.`;

        // Gửi NV
        if (hd.nhan_vien_id) await guiThongBao(hd.nhan_vien_id, tieuDe, noiDungNv, hd.id);
        // Gửi Admin
        for (const ad of admins) await guiThongBao(ad.id, tieuDe, noiDungAd, hd.id);
      }
    }

    // ===================================================================
    // TRƯỜNG HỢP 2: ĐÃ HẾT HẠN (Đến ngày hôm nay là hết hạn)
    // Logic: Gửi thông báo "Đã hết hạn" -> SAU ĐÓ update thành 'het_han' ngay
    // ===================================================================
    const [expiredList]: any = await pool.query(`
        SELECT hd.id, hd.nhan_vien_id, hd.so_hop_dong, nv.ho_ten,
               DATE_FORMAT(hd.ngay_ket_thuc, '%d/%m/%Y') as ngay_ket_thuc_fmt
        FROM hop_dong hd
        JOIN nhan_vien nv ON hd.nhan_vien_id = nv.id
        WHERE hd.trang_thai = 'con_hieu_luc'
          -- Lấy các hợp đồng có ngày kết thúc là hôm nay hoặc đã qua mà chưa update
          AND hd.ngay_ket_thuc <= CURDATE()
    `);

    if (expiredList.length > 0) {
      console.log(`⚠️ Tìm thấy ${expiredList.length} hợp đồng đến hạn/quá hạn hôm nay.`);

      for (const hd of expiredList) {
        const tieuDe = `ĐÃ HẾT HẠN HĐ: ${hd.so_hop_dong}`;
        const noiDungNv = `Hợp đồng số ${hd.so_hop_dong} của bạn ĐÃ HẾT HẠN vào ngày ${hd.ngay_ket_thuc_fmt}. Vui lòng liên hệ nhân sự.`;
        const noiDungAd = `Hợp đồng của ${hd.ho_ten} (Số: ${hd.so_hop_dong}) đã chính thức hết hạn ngày ${hd.ngay_ket_thuc_fmt}.`;

        // 1. Gửi thông báo trước
        if (hd.nhan_vien_id) await guiThongBao(hd.nhan_vien_id, tieuDe, noiDungNv, hd.id);
        for (const ad of admins) await guiThongBao(ad.id, tieuDe, noiDungAd, hd.id);

        // 2. Cập nhật trạng thái ngay lập tức (Để mai không quét lại nữa)
        await pool.query("UPDATE hop_dong SET trang_thai = 'het_han' WHERE id = ?", [hd.id]);
      }
      console.log(`✅ Đã gửi thông báo và đóng ${expiredList.length} hợp đồng.`);
    }
  } catch (err) {
    console.error("❌ Lỗi Cron Job Hợp đồng:", err);
  }
  console.log("🏁 Hoàn thành.");
}

// Hàm phụ để gửi thông báo cho gọn code (DRY)
async function guiThongBao(
  nguoiNhanId: number,
  tieuDe: string,
  noiDung: string,
  hopDongId: number
) {
  await taoThongBao({
    nguoi_nhan_id: nguoiNhanId,
    loai: "hop_dong",
    tieu_de: tieuDe,
    noi_dung: noiDung,
    tham_chieu_loai: "hop_dong",
    tham_chieu_id: hopDongId,
    nguoi_tao_id: null, // Để NULL tránh lỗi Foreign Key
    trang_thai: "chua_doc",
  });
}
