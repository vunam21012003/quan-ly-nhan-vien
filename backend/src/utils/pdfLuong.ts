// src/utils/pdfLuong.ts
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

// Format số tiền
function format(n: number) {
  return Number(n || 0).toLocaleString("vi-VN");
}

export async function buildPdfLuong({ nhanVien, luong, lich_su = [] }: any) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 50 });

    const buffers: any[] = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));

    // =========================
    // Load font Roboto
    // =========================
    const fontRegular = path.join(process.cwd(), "fonts", "Roboto-Regular.ttf");
    const fontBold = path.join(process.cwd(), "fonts", "Roboto-Bold.ttf");

    doc.registerFont("regular", fontRegular);
    doc.registerFont("bold", fontBold);

    doc.font("bold").fontSize(20).text("PHIẾU LƯƠNG NHÂN VIÊN", { align: "center" });
    doc.moveDown();
    doc
      .font("regular")
      .fontSize(12)
      .text(`Tháng: ${luong.thang}/${luong.nam}`, { align: "center" });
    doc.moveDown(2);

    // ================================
    // I. THÔNG TIN NHÂN VIÊN
    // ================================
    doc.font("bold").fontSize(14).text("I. THÔNG TIN NHÂN VIÊN");
    doc.moveDown(0.5);

    doc.font("regular").fontSize(12).text(`• Họ tên: ${nhanVien.ho_ten}`);
    doc.text(`• Phòng ban: ${nhanVien.phong_ban || ""}`);
    doc.text(`• Chức vụ: ${nhanVien.chuc_vu || ""}`);
    doc.moveDown();

    // ================================
    // II. THU NHẬP 3P
    // ================================
    doc.font("bold").fontSize(14).text("II. THU NHẬP 3P");
    doc.moveDown(0.5);

    // P1
    doc.font("bold").fontSize(13).text("P1 – Lương theo vị trí & công việc:");
    doc
      .font("regular")
      .fontSize(12)
      .text(`• Lương P1: ${format(luong.luong_p1)} đ`);
    doc.text(`• Ngày công: ${luong.so_ngay_cong}`);
    doc.text(`• Giờ tăng ca: ${luong.gio_tang_ca} giờ`);
    doc.moveDown(0.5);

    // P2
    doc.font("bold").fontSize(13).text("P2 – Phụ cấp:");
    doc
      .font("regular")
      .fontSize(12)
      .text(`• Phụ cấp P2: ${format(luong.luong_p2)} đ`);
    doc.moveDown(0.5);

    // P3
    doc.font("bold").fontSize(13).text("P3 – Thưởng/Khác:");
    doc
      .font("regular")
      .fontSize(12)
      .text(`• Thu nhập P3: ${format(luong.luong_p3)} đ`);
    doc.moveDown(0.5);

    doc
      .font("bold")
      .fontSize(12)
      .text(`➡ Tổng thu nhập GROSS: ${format(luong.tong_luong)} đ`);
    doc.moveDown();

    // ================================
    // III. KHẤU TRỪ
    // ================================
    doc.font("bold").fontSize(14).text("III. KHẤU TRỪ");
    doc.font("regular").fontSize(12);
    doc.text(`• BHXH: ${format(luong.bhxh)} đ`);
    doc.text(`• BHYT: ${format(luong.bhyt)} đ`);
    doc.text(`• BHTN: ${format(luong.bhtn)} đ`);
    doc.text(`• Thuế TNCN: ${format(luong.thue_tncn)} đ`);
    doc.moveDown();

    // ================================
    // IV. LƯƠNG THỰC NHẬN (NET)
    // ================================
    doc
      .font("bold")
      .fontSize(13)
      .text(`• Lương NET: ${format(luong.luong_thuc_nhan)} đ`);
    doc.moveDown(2);

    // ================================
    // V. LỊCH SỬ TRẢ LƯƠNG
    // ================================
    doc.font("bold").fontSize(14).text("V. LỊCH SỬ TRẢ LƯƠNG");
    doc.moveDown(0.5);

    if (!lich_su || lich_su.length === 0) {
      doc.font("regular").text("• Chưa có lịch sử trả lương.");
    } else {
      lich_su.forEach((h: any, i: number) => {
        doc
          .font("regular")
          .text(`${i + 1}. Ngày ${h.ngay_tra} — ${format(h.so_tien)} đ — ${h.trang_thai}`);
      });
    }

    // ================================
    // Footer
    // ================================
    doc.moveDown(3);
    doc
      .font("regular")
      .fontSize(11)
      .text("Cảm ơn bạn đã nỗ lực đóng góp cho công ty!", { align: "center" });

    doc.end();
  });
}
