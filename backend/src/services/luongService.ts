import { pool } from "../db";
import { Request } from "express";

/**
 * Hàm tiện ích dựng filter chung
 */
function buildCommonFilters(req: Request) {
  const page = Math.max(parseInt(String(req.query.page ?? "1"), 10), 1);
  const limit = Math.max(parseInt(String(req.query.limit ?? "20"), 10), 1);
  const offset = (page - 1) * limit;

  const thang = req.query.thang ? parseInt(String(req.query.thang), 10) : undefined;
  const nam = req.query.nam ? parseInt(String(req.query.nam), 10) : undefined;
  const nhan_vien_id = req.query.nhan_vien_id
    ? parseInt(String(req.query.nhan_vien_id), 10)
    : undefined;
  const q = (req.query.q as string | undefined)?.trim();

  const where: string[] = [];
  const params: any[] = [];

  if (thang) {
    where.push("l.thang = ?");
    params.push(thang);
  }
  if (nam) {
    where.push("l.nam = ?");
    params.push(nam);
  }
  if (nhan_vien_id) {
    where.push("l.nhan_vien_id = ?");
    params.push(nhan_vien_id);
  }
  if (q) {
    where.push("nv.ho_ten LIKE ?");
    params.push(`%${q}%`);
  }

  return { page, limit, offset, where, params };
}

/**
 * Lấy lương toàn hệ thống (admin/manager)
 */
export const getAll = async (req: Request) => {
  const user = (req as any).user;
  const { page, limit, offset, where, params } = buildCommonFilters(req);

  if (user.role === "manager") {
    where.push("pb.manager_taikhoan_id = ?");
    params.push(user.id);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countSql = `
    SELECT COUNT(*) AS total
    FROM luong l
    JOIN nhan_vien nv ON nv.id = l.nhan_vien_id
    LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
    ${whereSql}
  `;
  const [countRows] = await pool.query(countSql, params);
  const total = (countRows as any[])[0]?.total ?? 0;

  const dataSql = `
    SELECT 
      l.*, 
      nv.ho_ten, 
      nv.he_so_luong,
      COALESCE(t.tong_gio, 0) AS tong_gio_lam
    FROM luong l
    JOIN nhan_vien nv ON nv.id = l.nhan_vien_id
    LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
    LEFT JOIN tong_gio_lam t 
      ON t.nhan_vien_id = nv.id 
      AND t.thang_nam = CONCAT(l.nam, '-', LPAD(l.thang, 2, '0'))
    ${whereSql}
    ORDER BY l.nam DESC, l.thang DESC, l.id DESC
    LIMIT ? OFFSET ?
  `;

  const dataParams = [...params, limit, offset];
  const [rows] = await pool.query(dataSql, dataParams);
  console.log("⚡ SQL:", dataSql, dataParams);
  return { page, limit, total, items: rows };
};

/**
 * Lấy lương của chính nhân viên đăng nhập
 */
export const getMine = async (req: Request) => {
  const user = (req as any).user;
  if (!user) return { error: "Không xác định người dùng" };

  const page = Math.max(parseInt(String(req.query.page ?? "1"), 10), 1);
  const limit = Math.max(parseInt(String(req.query.limit ?? "20"), 10), 1);
  const offset = (page - 1) * limit;

  const thang = req.query.thang ? parseInt(String(req.query.thang), 10) : undefined;
  const nam = req.query.nam ? parseInt(String(req.query.nam), 10) : undefined;

  const [[me]]: any = await pool.query("SELECT nhan_vien_id FROM tai_khoan WHERE id = ?", [
    user.id,
  ]);
  const nhanVienId = me?.nhan_vien_id;
  if (!nhanVienId) return { error: "Tài khoản chưa liên kết nhân viên" };

  const where: string[] = ["l.nhan_vien_id = ?"];
  const params: any[] = [nhanVienId];
  if (!Number.isNaN(thang)) {
    where.push("l.thang = ?");
    params.push(thang);
  }
  if (!Number.isNaN(nam)) {
    where.push("l.nam = ?");
    params.push(nam);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;

  const countSql = `SELECT COUNT(*) AS total FROM luong l ${whereSql}`;
  const [countRows] = await pool.query(countSql, params);
  const total = (countRows as any[])[0]?.total ?? 0;

  const dataSql = `
    SELECT 
      l.*, 
      nv.ho_ten, 
      nv.he_so_luong,
      COALESCE(t.tong_gio, 0) AS tong_gio_lam
    FROM luong l
    JOIN nhan_vien nv ON nv.id = l.nhan_vien_id
    LEFT JOIN tong_gio_lam t 
      ON t.nhan_vien_id = nv.id 
      AND t.thang_nam = CONCAT(l.nam, '-', LPAD(l.thang, 2, '0'))
    ${whereSql}
    ORDER BY l.nam DESC, l.thang DESC
    LIMIT ? OFFSET ?
  `;
  const [rows] = await pool.query(dataSql, [...params, limit, offset]);
  return { page, limit, total, items: rows };
};

/**
 * Lấy chi tiết lương theo ID
 */
export const getById = async (req: Request) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return null;

  const sql = `
    SELECT 
      l.*, 
      nv.ho_ten, 
      nv.he_so_luong, 
      pb.ten_phong_ban
    FROM luong l
    JOIN nhan_vien nv ON nv.id = l.nhan_vien_id
    LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
    WHERE l.id = ?
    LIMIT 1
  `;
  const [[row]]: any = await pool.query(sql, [id]);
  return row || null;
};

/**
 * Tạo bản lương
 */
export const create = async (body: any) => {
  const { nhan_vien_id, thang, nam, luong_co_ban, phu_cap, thuong, khau_tru } = body;
  if (!nhan_vien_id || !thang || !nam || luong_co_ban == null)
    return { error: "Thiếu thông tin bắt buộc" };

  const sql = `
    INSERT INTO luong (nhan_vien_id, thang, nam, luong_co_ban, phu_cap, thuong, khau_tru)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  const [r] = await pool.execute(sql, [
    nhan_vien_id,
    thang,
    nam,
    luong_co_ban,
    phu_cap ?? 0,
    thuong ?? 0,
    khau_tru ?? 0,
  ]);
  return { id: (r as any).insertId };
};

/**
 * Cập nhật bản lương
 */
export const update = async (id: number, body: any) => {
  const allowed = ["nhan_vien_id", "thang", "nam", "luong_co_ban", "phu_cap", "thuong", "khau_tru"];
  const fields = allowed.filter((k) => body[k] !== undefined);
  if (!fields.length) return { error: "Không có trường hợp lệ để cập nhật" };

  const sets = fields.map((k) => `${k} = ?`).join(", ");
  const values = fields.map((k) => body[k]);
  await pool.execute(`UPDATE luong SET ${sets} WHERE id = ?`, [...values, id]);
  return { ok: true };
};

/**
 * Xoá bản lương
 */
export const remove = async (id: number) => {
  if (!Number.isInteger(id) || id <= 0) return false;
  await pool.execute("DELETE FROM luong WHERE id = ?", [id]);
  return true;
};

/**
 * Tính lương tự động theo tháng
 */
export const calcSalaryForMonth = async (thang: number, nam: number) => {
  // ✅ 1. Lấy danh sách ngày lễ trong tháng
  const [holidays]: any = await pool.query(
    `
    SELECT ngay, ten_ngay, diem_cong, so_ngay_nghi, he_so_luong
    FROM ngay_le
    WHERE MONTH(ngay) = ? AND YEAR(ngay) = ?
    `,
    [thang, nam]
  );

  console.log("🎉 Ngày lễ trong tháng:", holidays);

  // ✅ 2. Lấy danh sách nhân viên + hợp đồng + công tháng
  const sql = `
    SELECT 
      nv.id AS nhan_vien_id,
      nv.ho_ten,
      hd.luong_thoa_thuan,
      hd.ngay_bat_dau,
      hd.ngay_ket_thuc,
      COALESCE(t.gio_ngay_thuong, 0) AS gio_ngay_thuong,
      COALESCE(t.gio_ngay_le, 0) AS gio_ngay_le,
      COALESCE(t.gio_tang_ca, 0) AS gio_tang_ca,
      COALESCE(t.tong_gio, 0) AS tong_gio,
      COALESCE(t.tong_diem_cong, 0) AS tong_diem_cong
    FROM nhan_vien nv
    LEFT JOIN tong_gio_lam t 
      ON nv.id = t.nhan_vien_id 
      AND t.thang_nam = CONCAT(?, '-', LPAD(?, 2, '0'))
    LEFT JOIN hop_dong hd 
      ON nv.id = hd.nhan_vien_id 
      AND hd.trang_thai = 'con_hieu_luc'
      AND (
        hd.ngay_bat_dau <= DATE(CONCAT(?, '-', LPAD(?, 2, '0'), '-31'))
        AND (hd.ngay_ket_thuc IS NULL OR hd.ngay_ket_thuc >= DATE(CONCAT(?, '-', LPAD(?, 2, '0'), '-01')))
      )
    WHERE hd.luong_thoa_thuan IS NOT NULL
  `;
  const [rows]: any = await pool.query(sql, [nam, thang, nam, thang, nam, thang]);

  // ✅ 3. Tính tổng ngày lễ (được tính công)
  const tongNgayLe = holidays.reduce(
    (sum: number, h: any) => sum + (h.so_ngay_nghi || 1) * (h.diem_cong || 1),
    0
  );

  // ✅ 4. Hệ số tăng ca
  const heSoTangCa = 1.5;

  // ✅ 5. Tính toán chi tiết cho từng nhân viên
  const results = rows
    .filter((r: any) => r.luong_thoa_thuan != null)
    .map((r: any) => {
      const luongThoaThuan = Number(r.luong_thoa_thuan ?? 0);
      const luongTheoGio = luongThoaThuan / 208; // 26 ngày * 8h

      const luongNgayThuong = r.gio_ngay_thuong * luongTheoGio;
      const luongNgayLe = r.gio_ngay_le * luongTheoGio;
      const luongTangCa = r.gio_tang_ca * luongTheoGio * heSoTangCa;

      const tongLuong = luongNgayThuong + luongNgayLe + luongTangCa;

      // ✅ Cộng thêm ngày lễ được tính công
      const ngayCong = Number(((r.gio_ngay_thuong + r.gio_tang_ca) / 8 + tongNgayLe).toFixed(2));

      // 💰 Tính bảo hiểm
      const bhxh = tongLuong * 0.08;
      const bhyt = tongLuong * 0.015;
      const bhtn = tongLuong * 0.01;
      const tongBH = bhxh + bhyt + bhtn;

      const thueTNCN = 0;
      const khauTru = 0;
      const thuong = 0;

      const luongThucNhan = tongLuong - tongBH;

      return {
        ...r,
        ngayCong,
        luong_co_ban: luongThoaThuan,
        tong_luong: tongLuong,
        bhxh,
        bhyt,
        bhtn,
        tong_bh: tongBH,
        thuong,
        thue_tncn: thueTNCN,
        khau_tru: khauTru,
        luong_thuc_nhan: luongThucNhan,
      };
    });

  console.log(
    "🧩 Kết quả tính lương tháng có cộng ngày lễ:",
    results.map((r: any) => ({
      nhan_vien: r.ho_ten,
      ngay_cong: r.ngayCong,
      luong_thoa_thuan: r.luong_thoa_thuan,
      tong_luong: r.tong_luong?.toFixed(2),
    }))
  );

  // ✅ 6. Ghi vào bảng lương
  for (const r of results) {
    await pool.execute(
      `
      INSERT INTO luong (
        nhan_vien_id, luong_co_ban, phu_cap, thuong, khau_tru,
        thang, nam, ngay_cong, ngay_tinh,
        tong_luong, bhxh, bhyt, bhtn, tong_bh, thue_tncn, luong_thuc_nhan
      )
      VALUES (?, ?, 0, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        luong_co_ban = VALUES(luong_co_ban),
        tong_luong = VALUES(tong_luong),
        bhxh = VALUES(bhxh),
        bhyt = VALUES(bhyt),
        bhtn = VALUES(bhtn),
        tong_bh = VALUES(tong_bh),
        thuong = VALUES(thuong),
        thue_tncn = VALUES(thue_tncn),
        khau_tru = VALUES(khau_tru),
        luong_thuc_nhan = VALUES(luong_thuc_nhan),
        ngay_cong = VALUES(ngay_cong),
        ngay_tinh = NOW()
      `,
      [
        r.nhan_vien_id,
        r.luong_co_ban,
        r.thuong,
        r.khau_tru,
        thang,
        nam,
        r.ngayCong,
        r.tong_luong,
        r.bhxh,
        r.bhyt,
        r.bhtn,
        r.tong_bh,
        r.thue_tncn,
        r.luong_thuc_nhan,
      ]
    );
  }

  // ✅ 7. Danh sách nhân viên không có hợp đồng
  const invalidContracts = rows
    .filter((r: any) => r.luong_thoa_thuan == null)
    .map((r: any) => r.ho_ten);

  return { thang, nam, count: results.length, items: results, invalidContracts };
};

/**
 * Chia thưởng toàn hệ thống
 */
export const chiaThuong = async (body: any) => {
  const tongThuong = Number(body.tong_thuong || 0);
  let tyLeCoDinh = Number(body.ty_le_co_dinh || 0);
  let tyLeDiemCong = Number(body.ty_le_diem_cong || 0);

  if (tyLeCoDinh > 1) tyLeCoDinh /= 100;
  if (tyLeDiemCong > 1) tyLeDiemCong /= 100;

  const tongTyLe = tyLeCoDinh + tyLeDiemCong;
  if (tongTyLe > 1) return { error: "Tổng tỷ lệ thưởng vượt quá 100%!" };

  let tongThuongThucTe = tongThuong;
  if (tongThuongThucTe <= 0) {
    const [[{ totalLuong }]]: any = await pool.query(
      `SELECT SUM(luong_co_ban) AS totalLuong FROM luong`
    );
    tongThuongThucTe = totalLuong * 0.05;
  }

  const [rows]: any = await pool.query(`
    SELECT 
      nv.id AS nhan_vien_id,
      nv.ho_ten,
      COALESCE(t.tong_diem_cong, 0) AS tong_diem_cong
    FROM nhan_vien nv
    LEFT JOIN tong_gio_lam t ON nv.id = t.nhan_vien_id
  `);

  if (!rows.length) return { error: "Không có dữ liệu nhân viên để chia thưởng" };

  const tongNhanVien = rows.length;
  const tongDiemCong = rows.reduce(
    (sum: number, nv: any) => sum + Number(nv.tong_diem_cong || 0),
    0
  );

  for (const nv of rows) {
    const diem = Number(nv.tong_diem_cong || 0);
    const thuongCoDinh = (tongThuongThucTe * tyLeCoDinh) / tongNhanVien;
    const thuongKPI =
      tongDiemCong > 0 ? (tongThuongThucTe * tyLeDiemCong * diem) / tongDiemCong : 0;

    const tongThuongNV = thuongCoDinh + thuongKPI;

    await pool.execute(
      `
      UPDATE luong 
      SET thuong = ?, ngay_tinh = NOW() 
      WHERE nhan_vien_id = ? 
      ORDER BY nam DESC, thang DESC 
      LIMIT 1
      `,
      [tongThuongNV, nv.nhan_vien_id]
    );
  }

  return {
    message: `✅ Đã chia thưởng cho ${rows.length} nhân viên`,
    tong_thuong: tongThuongThucTe,
    ty_le_co_dinh: tyLeCoDinh,
    ty_le_diem_cong: tyLeDiemCong,
  };
};
