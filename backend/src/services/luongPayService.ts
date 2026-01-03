// src/services/luongPayService.ts
import { pool } from "../db";
import { buildPdfLuong } from "../utils/pdfLuong";
import { sendEmail } from "../utils/sendMail";
import { tao as taoThongBao } from "./thongBaoService";

export const pay = async (req: any) => {
  const { nhan_vien_id, thang, nam } = req.body;
  const rawSoTienTra = req.body.so_tien_thuc_tra;
  const user = req.user;

  // Kiểm tra nhân viên
  const [[nv]]: any = await pool.query("SELECT * FROM nhan_vien WHERE id = ? LIMIT 1", [
    nhan_vien_id,
  ]);
  if (!nv) throw new Error("Không tìm thấy nhân viên");

  const [[luong]]: any = await pool.query(
    "SELECT * FROM luong WHERE nhan_vien_id = ? AND thang = ? AND nam = ? LIMIT 1",
    [nhan_vien_id, thang, nam]
  );
  if (!luong) throw new Error("Không có bảng lương tháng này");

  if (luong.trang_thai_duyet !== "da_duyet") {
    throw new Error("Bảng lương này chưa được duyệt, không thể thực hiện thanh toán.");
  }

  const tongThucNhanDong100 = Math.round(Number(luong.luong_thuc_nhan || 0) * 100);

  // Kiểm tra lịch sử thanh toán
  const [[checkPaid]]: any = await pool.query(
    `SELECT id FROM lich_su_tra_luong 
     WHERE nhan_vien_id = ? AND thang = ? AND nam = ? AND trang_thai = 'da_thanh_toan' LIMIT 1`,
    [nhan_vien_id, thang, nam]
  );
  if (checkPaid) {
    throw new Error("Kỳ lương này đã được thanh toán hoàn tất trước đó.");
  }

  const [[lsSum]]: any = await pool.query(
    `
      SELECT COALESCE(SUM(so_tien_thuc_tra), 0) AS da_tra
      FROM lich_su_tra_luong
      WHERE nhan_vien_id = ? AND thang = ? AND nam = ? AND trang_thai != 'cho_xu_ly'
    `,
    [nhan_vien_id, thang, nam]
  );

  const daTraTruocDong100 = Math.round(Number(lsSum.da_tra || 0) * 100);
  let conNoDong100 = tongThucNhanDong100 - daTraTruocDong100;

  // Xử lý số tiền trả lần này
  let soTienTraDong100: number;

  if (tongThucNhanDong100 === 0) {
    soTienTraDong100 = 0;
  } else if (rawSoTienTra === undefined || rawSoTienTra === null || rawSoTienTra === "") {
    soTienTraDong100 = conNoDong100;
  } else {
    const n = Number(rawSoTienTra);
    if (n < 0) throw new Error("Số tiền trả không được nhỏ hơn 0");

    if (n === 0 && tongThucNhanDong100 > 0) {
      soTienTraDong100 = conNoDong100;
    } else {
      soTienTraDong100 = Math.round(n * 100);
    }
  }

  if (tongThucNhanDong100 > 0 && soTienTraDong100 > conNoDong100) {
    throw new Error(
      `Số tiền trả (${soTienTraDong100 / 100}) vượt quá số còn nợ (${conNoDong100 / 100})`
    );
  }

  let conNoSauDong100 = conNoDong100 - soTienTraDong100;
  if (Math.abs(conNoSauDong100) < 1) conNoSauDong100 = 0;

  // Xác định trạng thái mới
  let trangThaiMoi: "con_no" | "da_thanh_toan";
  if (conNoSauDong100 <= 0) {
    trangThaiMoi = "da_thanh_toan";
  } else {
    trangThaiMoi = "con_no";
  }

  const nguoiThucHienId = req.user?.nhan_vien_id;
  if (!nguoiThucHienId) {
    throw new Error("Tài khoản không gắn nhân viên → không thể ghi lịch sử");
  }

  const soTienTra = soTienTraDong100 / 100;

  // Ghi lịch sử trả lương
  const [insertResult]: any = await pool.query(
    `
      INSERT INTO lich_su_tra_luong
        (nhan_vien_id, thang, nam, so_tien_thuc_tra, ngay_tra, trang_thai, nguoi_thuc_hien_id, ghi_chu)
      VALUES (?, ?, ?, ?, CURDATE(), ?, ?, ?)
    `,
    [
      nhan_vien_id,
      thang,
      nam,
      soTienTra,
      trangThaiMoi,
      nguoiThucHienId,
      tongThucNhanDong100 === 0 ? "Tất toán lương 0đ" : "",
    ]
  );

  const lichSuTraLuongId = insertResult.insertId;

  // Tạo thông báo
  if (trangThaiMoi === "da_thanh_toan") {
    await taoThongBao({
      nguoi_nhan_id: nhan_vien_id,
      loai: "luong",
      tieu_de: `Lương tháng ${thang}/${nam} đã được thanh toán`,
      noi_dung: `Kỳ lương tháng ${thang}/${nam} của bạn đã được thanh toán hoàn tất.`,
      tham_chieu_loai: "lich_su_tra_luong",
      tham_chieu_id: lichSuTraLuongId,
      nguoi_tao_id: nguoiThucHienId,
    });
  }

  // Gửi email PDF
  let sentPdf = false;
  const isTraFullLanDau = daTraTruocDong100 === 0 && soTienTraDong100 === tongThucNhanDong100;

  if (isTraFullLanDau && nv.email) {
    const [lich_su] = await pool.query(
      `SELECT DATE_FORMAT(ngay_tra, '%d/%m/%Y') AS ngay_tra, so_tien_thuc_tra, trang_thai 
       FROM lich_su_tra_luong WHERE nhan_vien_id = ? AND thang = ? AND nam = ? ORDER BY created_at ASC`,
      [nhan_vien_id, thang, nam]
    );

    const pdfBuffer = await buildPdfLuong({ nhanVien: nv, luong, lich_su });

    await sendEmail({
      to: nv.email,
      subject: `Phiếu lương tháng ${thang}/${nam}`,
      text: "Vui lòng xem phiếu lương đính kèm.",
      attachments: [{ filename: `phieu-luong-${nv.id}-${thang}-${nam}.pdf`, content: pdfBuffer }],
    });
    sentPdf = true;
  }

  // Trả về kết quả cho FE
  return {
    ok: true,
    nhan_vien_id,
    thang,
    nam,
    tra: soTienTra,
    con_no_sau: conNoSauDong100 / 100,
    trang_thai: trangThaiMoi,
    sentPdf,
  };
};

export const payAll = async (req: any) => {
  const { thang, nam, phong_ban_id } = req.body;
  const user = req.user;

  if (!thang || !nam) {
    throw new Error("Vui lòng chọn tháng và năm.");
  }
  let sql = `
    SELECT l.nhan_vien_id
    FROM luong l
    JOIN nhan_vien nv ON l.nhan_vien_id = nv.id
    WHERE l.thang = ? 
      AND l.nam = ? 
      AND l.trang_thai_duyet = 'da_duyet' 
      AND EXISTS (
          SELECT 1 FROM lich_su_tra_luong ls 
          WHERE ls.nhan_vien_id = l.nhan_vien_id 
            AND ls.thang = l.thang 
            AND ls.nam = l.nam 
            AND ls.trang_thai IN ('cho_xu_ly', 'con_no') -- Chỉ lấy những người đang chờ trả hoặc còn nợ
      )
  `;

  const params: any[] = [thang, nam];
  if (phong_ban_id) {
    sql += " AND nv.phong_ban_id = ?";
    params.push(phong_ban_id);
  }

  const [list]: any = await pool.query(sql, params);

  if (list.length === 0) {
    return { count: 0, message: "Không có bảng lương nào đã duyệt đang chờ thanh toán." };
  }

  let successCount = 0;
  for (const item of list) {
    try {
      await pay({
        body: {
          nhan_vien_id: item.nhan_vien_id,
          thang,
          nam,
          so_tien_thuc_tra: null,
        },
        user: user,
      });
      successCount++;
    } catch (error) {
      console.error(`Lỗi trả lương NV ${item.nhan_vien_id}:`, error);
    }
  }

  return { count: successCount };
};
