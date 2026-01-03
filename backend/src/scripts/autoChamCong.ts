// src/scripts/autoChamCong.ts
import { pool } from "../db";
import { capNhatPhanTichCong } from "../services/phanTichCongService";

// ================== HÀM CHECK ĐƠN NGHỈ PHÉP ==================
async function checkApprovedLeave(nhan_vien_id: number, ngay_lam: string) {
  const [rows]: any = await pool.query(
    `SELECT * FROM don_nghi_phep 
      WHERE nhan_vien_id = ? 
        AND trang_thai = 'da_duyet'
        AND ? BETWEEN ngay_bat_dau AND ngay_ket_thuc
      ORDER BY created_at DESC
      LIMIT 1`,
    [nhan_vien_id, ngay_lam]
  );
  return rows[0] || null;
}

// ================== HÀM KIỂM TRA NGÀY LỄ CỐ ĐỊNH (MỚI THÊM) ==================
function getFixedHolidayInfo(dateStr: string): { type: "le" | "tet" | null; name: string } {
  const d = new Date(dateStr);
  const dateNum = d.getDate();
  const monthNum = d.getMonth() + 1;

  if (dateNum === 1 && monthNum === 1) return { type: "le", name: "Tết Dương Lịch" };
  if (dateNum === 30 && monthNum === 4) return { type: "le", name: "Ngày Giải phóng (30/4)" };
  if (dateNum === 1 && monthNum === 5) return { type: "le", name: "Quốc tế Lao động (1/5)" };
  if (dateNum === 2 && monthNum === 9) return { type: "le", name: "Quốc khánh (2/9)" };

  return { type: null, name: "" };
}

// ================== HÀM XÁC ĐỊNH LOẠI NGÀY TỪ CHẤM CÔNG ==================
type LoaiNgay = "thuong" | "le" | "tet" | "lam_bu";

async function detectLoaiNgayFromChamCong(ngaySql: string): Promise<LoaiNgay> {
  // 1. Ưu tiên kiểm tra ngày Lễ cố định trước
  const fixed = getFixedHolidayInfo(ngaySql);
  if (fixed.type) return fixed.type;

  // 2. Nếu không phải lễ cố định, kiểm tra trong DB xem Admin có set ngày này là Lễ/Tết/Làm bù cho ai chưa
  // (Dùng để bắt Tết Âm lịch hoặc Giỗ tổ Hùng Vương - những ngày lễ động)
  const [rows]: any = await pool.query(
    `SELECT DISTINCT loai_ngay 
        FROM cham_cong 
       WHERE ngay_lam = ? 
         AND loai_ngay IS NOT NULL
         AND loai_ngay != ''`,
    [ngaySql]
  );

  const priorities: LoaiNgay[] = ["tet", "le", "lam_bu", "thuong"];
  const existingTypes = rows
    .map((r: any) => String(r.loai_ngay || "").toLowerCase())
    .filter((v: string) => !!v) as LoaiNgay[];

  if (existingTypes.length === 0) return "thuong";

  for (const p of priorities) {
    if (existingTypes.includes(p)) return p;
  }
  return "thuong";
}

// ================== HÀM CHÍNH: TỰ ĐỘNG CHẤM CÔNG ==================
export async function xuLyTuDongChamCong(ngayXuLy?: string, isEndOfDay: boolean = false) {
  // Xác định ngày cần xử lý
  let processDate: string;
  if (ngayXuLy) {
    processDate = ngayXuLy;
  } else if (isEndOfDay) {
    processDate = new Date().toISOString().slice(0, 10);
  } else {
    // Mặc định chạy cho ngày hôm qua
    processDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  }

  const ngaySql = String(processDate).slice(0, 10);
  const thang = Number(ngaySql.slice(5, 7));
  const nam = Number(ngaySql.slice(0, 4));
  const dateObj = new Date(ngaySql);
  const dayOfWeek = dateObj.getDay();

  console.log(`\n${"=".repeat(70)}`);
  console.log(
    `TỰ ĐỘNG CHẤM CÔNG (AUTO-FILL) - Ngày: ${ngaySql} (Thứ ${dayOfWeek === 0 ? "CN" : dayOfWeek + 1})`
  );
  console.log(`${"=".repeat(70)}`);

  // 1. Xác định loại ngày (Kết hợp Lễ cố định + DB)
  const loaiNgayHeThong: LoaiNgay = await detectLoaiNgayFromChamCong(ngaySql);

  // Lấy thêm thông tin tên ngày lễ (nếu có) để ghi chú cho đẹp
  const fixedInfo = getFixedHolidayInfo(ngaySql);

  // 2. Lấy danh sách nhân viên đang làm việc
  const [allEmployees]: any = await pool.query(
    `SELECT nv.id AS nhan_vien_id, nv.ho_ten
     FROM nhan_vien nv
     WHERE nv.trang_thai = 'dang_lam' 
       AND (nv.da_xoa = 0 OR nv.da_xoa IS NULL)`
  );

  // 3. Lọc ra những người CHƯA có dữ liệu chấm công ngày đó
  const [checkedIn]: any = await pool.query(
    `SELECT DISTINCT nhan_vien_id FROM cham_cong WHERE ngay_lam = ?`,
    [ngaySql]
  );
  const checkedInIds = new Set(checkedIn.map((r: any) => r.nhan_vien_id));
  const employeesToProcess = allEmployees.filter((emp: any) => !checkedInIds.has(emp.nhan_vien_id));

  if (employeesToProcess.length === 0) {
    console.log("Tất cả nhân viên (hợp lệ) đã có dữ liệu chấm công.");
    return { success: true, processedCount: 0, date: ngaySql };
  }

  console.log(`Đang xử lý tự động cho: ${employeesToProcess.length} nhân viên chưa chấm công...`);

  let processedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  for (const emp of employeesToProcess) {
    const { nhan_vien_id, ho_ten } = emp;

    try {
      // Bỏ qua nếu lương tháng đã duyệt
      const [[luongStatus]]: any = await pool.query(
        `SELECT trang_thai_duyet FROM luong 
         WHERE nhan_vien_id = ? AND thang = ? AND nam = ?`,
        [nhan_vien_id, thang, nam]
      );

      if (luongStatus?.trang_thai_duyet === "da_duyet") {
        skippedCount++;
        continue;
      }

      // Khởi tạo biến mặc định
      let trang_thai = "vang_khong_phep";
      let ghi_chu = "";
      let loai_ngay: LoaiNgay = loaiNgayHeThong;

      let insertGioVao: string | null = null;
      let insertGioRa: string | null = null;
      let insertTongGio = 0;

      // === LOGIC XỬ LÝ ===

      // CASE 1: NGÀY LỄ / TẾT -> Tự động đánh dấu nghỉ Lễ (Có hưởng lương)
      if (loaiNgayHeThong === "le" || loaiNgayHeThong === "tet") {
        trang_thai = "di_lam"; // Trong DB, nghỉ lễ vẫn coi là trạng thái 'di_lam' (hoặc bạn có thể sửa thành 'nghi_le' tuỳ convention, nhưng thường để 'di_lam' với giờ = 0 để tính lương full)
        // Tuy nhiên, để clean, ta có thể dùng trạng thái riêng hoặc để trống giờ làm.
        // Ở đây tôi giữ logic cũ: coi như 1 ngày công hưởng lương.

        // Cập nhật: Theo logic PhanTichCong mới sửa, chỉ cần loai_ngay='le' và tong_gio=0 là được hưởng lương.
        trang_thai = "di_lam";
        const tenLe = fixedInfo.name || (loaiNgayHeThong === "tet" ? "Tết" : "Lễ");
        ghi_chu = `Nghỉ ${tenLe} (Tự động)`;

        insertGioVao = null;
        insertGioRa = null;
        insertTongGio = 0;
      }

      // CASE 2: CHỦ NHẬT (và không phải làm bù) -> Nghỉ cuối tuần
      else if (dayOfWeek === 0 && loaiNgayHeThong !== "lam_bu") {
        trang_thai = "di_lam"; // Hoặc trạng thái riêng 'nghi_cuoi_tuan'
        ghi_chu = "Nghỉ Chủ nhật (Tự động)";
        loai_ngay = "thuong";
        insertTongGio = 0;
      }

      // CASE 3: NGÀY THƯỜNG (hoặc làm bù)
      else {
        const leave = await checkApprovedLeave(nhan_vien_id, ngaySql);

        if (leave) {
          // A. CÓ ĐƠN NGHỈ PHÉP (Ưu tiên đơn nghỉ phép)
          if (Number(leave.so_ngay) === 0.5) {
            trang_thai = "nghi_phep";
            ghi_chu = `Nghỉ phép ${leave.buoi_nghi} (0.5) - ${leave.ly_do} (Auto)`;

            // Nếu nghỉ nửa ngày, giả định nửa ngày còn lại đi làm?
            // Thường auto sẽ không dám điền giờ nửa ngày còn lại vì không biết đi sáng hay chiều.
            // Nên để 0 giờ, chờ nhân viên bổ sung hoặc check máy chấm công thực tế.
          } else {
            // Nghỉ cả ngày
            trang_thai = "nghi_phep";
            const loaiNghiText = leave.loai_nghi === "khong_luong" ? "Không lương" : "Có lương";
            ghi_chu = `Nghỉ phép (${loaiNghiText}) - ${leave.ly_do} (Auto)`;
          }
        } else {
          // B. KHÔNG CÓ ĐƠN -> MẶC ĐỊNH ĐI LÀM ĐỦ CÔNG (AUTO FILL)
          trang_thai = "di_lam";
          ghi_chu = "Chấm công tự động (Đủ công)";
          loai_ngay = loaiNgayHeThong; // 'thuong' hoặc 'lam_bu'

          // Gán giờ mặc định hành chính (8h - 17h)
          insertGioVao = "08:00";
          insertGioRa = "17:00";
          insertTongGio = 8;
        }
      }

      // 4. INSERT VÀO DATABASE
      await pool.query(
        `INSERT INTO cham_cong
         (nhan_vien_id, ngay_lam, gio_vao, gio_ra, trang_thai, 
          ghi_chu, tong_gio, loai_ngay)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nhan_vien_id,
          ngaySql,
          insertGioVao,
          insertGioRa,
          trang_thai,
          ghi_chu,
          insertTongGio,
          loai_ngay,
        ]
      );

      // 5. Cập nhật bảng phân tích
      await capNhatPhanTichCong(nhan_vien_id, ngaySql);
      processedCount++;
    } catch (err: any) {
      console.error(`Lỗi Auto Chấm công [${ho_ten}]: ${err.message}`);
      errors.push(`${ho_ten}: ${err.message}`);
    }
  }

  return {
    success: true,
    processedCount,
    skippedCount,
    errors: errors.length > 0 ? errors : undefined,
  };
}
