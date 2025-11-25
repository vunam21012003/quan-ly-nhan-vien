// src/services/luongPayService.ts
import { pool } from "../db";
import { buildPdfLuong } from "../utils/pdfLuong";
import { sendEmail } from "../utils/sendMail";

export const pay = async (req: any) => {
  const { nhan_vien_id, thang, nam } = req.body;
  // có thể undefined hoặc chuỗi rỗng
  const rawSoTienTra = req.body.so_tien_thuc_tra;

  const user = req.user;

  // ----------------------------------------
  // 1. Kiểm tra nhân viên
  // ----------------------------------------
  const [[nv]]: any = await pool.query("SELECT * FROM nhan_vien WHERE id = ? LIMIT 1", [
    nhan_vien_id,
  ]);
  if (!nv) throw new Error("Không tìm thấy nhân viên");

  // ----------------------------------------
  // 2. Lấy bảng lương
  // ----------------------------------------
  const [[luong]]: any = await pool.query(
    "SELECT * FROM luong WHERE nhan_vien_id = ? AND thang = ? AND nam = ? LIMIT 1",
    [nhan_vien_id, thang, nam]
  );
  if (!luong) throw new Error("Không có bảng lương tháng này");

  // Dùng đơn vị: đồng * 100 để tránh sai số float
  const tongThucNhanDong100 = Math.round(Number(luong.luong_thuc_nhan || 0) * 100);

  // ----------------------------------------
  // 3. Lấy tổng số đã trả trước đó
  // ----------------------------------------
  const [[ls]]: any = await pool.query(
    `
      SELECT COALESCE(SUM(so_tien_thuc_tra), 0) AS da_tra
      FROM lich_su_tra_luong
      WHERE nhan_vien_id = ? AND thang = ? AND nam = ?
    `,
    [nhan_vien_id, thang, nam]
  );

  const daTraTruocDong100 = Math.round(Number(ls.da_tra || 0) * 100);
  let conNoDong100 = tongThucNhanDong100 - daTraTruocDong100;

  if (conNoDong100 <= 0) {
    throw new Error("Kỳ lương này đã được thanh toán hết");
  }

  // ----------------------------------------
  // 4. Xử lý số tiền trả lần này
  //    - Nếu không nhập hoặc <= 0 → mặc định trả hết phần còn nợ
  // ----------------------------------------
  let soTienTraDong100: number;

  if (rawSoTienTra === undefined || rawSoTienTra === null || rawSoTienTra === "") {
    // không nhập → trả full phần còn nợ
    soTienTraDong100 = conNoDong100;
  } else {
    const n = Number(rawSoTienTra);
    if (!n || n <= 0) {
      // nhập 0 hoặc giá trị không hợp lệ → cũng xem như trả full phần còn nợ
      soTienTraDong100 = conNoDong100;
    } else {
      soTienTraDong100 = Math.round(n * 100);
    }
  }

  if (soTienTraDong100 > conNoDong100) {
    const soTienTra = soTienTraDong100 / 100;
    const conNo = conNoDong100 / 100;
    throw new Error(
      `Số tiền trả (${soTienTra.toLocaleString(
        "vi-VN"
      )}) vượt quá số còn nợ (${conNo.toLocaleString("vi-VN")})`
    );
  }

  let conNoSauDong100 = conNoDong100 - soTienTraDong100;

  // Làm tròn sai số cực nhỏ (nếu có) về 0
  if (Math.abs(conNoSauDong100) < 1) {
    conNoSauDong100 = 0;
  }

  // ----------------------------------------
  // 5. Xác định trạng thái mới của KỲ LƯƠNG
  // ----------------------------------------
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

  // Giá trị tiền trả thực để lưu DB (2 chữ số thập phân)
  const soTienTra = soTienTraDong100 / 100;

  // ----------------------------------------
  // 6. MỖI LẦN TRẢ → LUÔN TẠO 1 DÒNG MỚI
  // ----------------------------------------
  await pool.query(
    `
      INSERT INTO lich_su_tra_luong
        (nhan_vien_id, thang, nam, so_tien_thuc_tra, ngay_tra, trang_thai, nguoi_thuc_hien_id)
      VALUES (?, ?, ?, ?, CURDATE(), ?, ?)
    `,
    [nhan_vien_id, thang, nam, soTienTra, trangThaiMoi, nguoiThucHienId]
  );

  // ----------------------------------------
  // 7. Gửi email PDF nếu là lần đầu và trả FULL
  // ----------------------------------------
  let sentPdf = false;
  const isTraFullLanDau = daTraTruocDong100 === 0 && soTienTraDong100 === tongThucNhanDong100;

  if (isTraFullLanDau && nv.email) {
    // 🔥 LẤY LỊCH SỬ TRẢ LƯƠNG ĐẦY ĐỦ
    const [lich_su] = await pool.query(
      `
      SELECT
        DATE_FORMAT(ngay_tra, '%d/%m/%Y') AS ngay_tra,
        so_tien_thuc_tra,
        trang_thai
      FROM lich_su_tra_luong
      WHERE nhan_vien_id = ? AND thang = ? AND nam = ?
      ORDER BY created_at ASC
    `,
      [nhan_vien_id, thang, nam]
    );

    // 🔥 TRUYỀN LỊCH SỬ VÀO PDF
    const pdfBuffer = await buildPdfLuong({
      nhanVien: nv,
      luong,
      lich_su, // << THÊM DÒNG NÀY
    });

    await sendEmail({
      to: nv.email,
      subject: `Phiếu lương tháng ${thang}/${nam}`,
      text: "Vui lòng xem phiếu lương đính kèm.",
      attachments: [
        {
          filename: `phieu-luong-${nv.id}-${thang}-${nam}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    sentPdf = true;
  }

  // ----------------------------------------
  // 8. Trả về FE
  // ----------------------------------------
  const conNoTruoc = conNoDong100 / 100;
  const conNoSau = conNoSauDong100 / 100;
  const daTraTruoc = daTraTruocDong100 / 100;

  return {
    ok: true,
    nhan_vien_id,
    thang,
    nam,
    tra: soTienTra,
    da_tra_truoc: daTraTruoc,
    con_no_truoc: conNoTruoc,
    con_no_sau: conNoSau,
    trang_thai: trangThaiMoi,
    sentPdf,
  };
};
