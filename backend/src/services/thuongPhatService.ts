// src/services/thuongPhatService.ts (FULL CODE ĐÃ CHỈNH SỬA)
import { pool } from "../db";
import * as ExcelJS from "exceljs";
import { isSalaryLocked } from "../utils/checkPaid";
import * as thongBaoService from "./thongBaoService";

export const getList = async (req: any) => {
  const { nhan_vien_id, loai, thang, nam, phong_ban_id } = req.query;
  const scope = req.phamvi;

  const where: string[] = [];
  const params: any[] = [];
  // ------------------------------
  // 1) LỌC CƠ BẢN
  // ------------------------------

  if (nhan_vien_id) {
    where.push("tp.nhan_vien_id = ?");
    params.push(nhan_vien_id);
  }
  if (loai) {
    where.push("tp.loai = ?");
    params.push(loai);
  }
  if (thang) {
    where.push("tp.thang = ?");
    params.push(thang);
  }
  if (nam) {
    where.push("tp.nam = ?");
    params.push(nam);
  }
  //Khi người dùng tự lọc PB, phải lọc cả bản ghi NV thuộc PB đó
  if (phong_ban_id) {
    where.push(`(
            tp.phong_ban_id = ?
            OR tp.nhan_vien_id IN (
                SELECT id FROM nhan_vien WHERE phong_ban_id = ? 
            )
        )`);
    params.push(phong_ban_id, phong_ban_id);
  }

  // ------------------------------
  // 2) PHÂN QUYỀN
  // ------------------------------

  if (scope.role === "employee") {
    // Nhân viên chỉ xem thưởng/phạt của phòng ban họ
    where.push("tp.phong_ban_id = (SELECT phong_ban_id FROM nhan_vien WHERE id = ?)");
    params.push(scope.employeeId);
  }
  if (scope.role === "manager" && scope.isAccountingManager) {
  } else if (scope.role === "manager") {
    if (!scope.managedDepartmentIds || !scope.managedDepartmentIds.length) {
      return { items: [] };
    }

    const pbIds = scope.managedDepartmentIds;
    const pbIdList = pbIds.map(() => "?").join(",");

    where.push(`(
    tp.phong_ban_id IN (${pbIdList})
    OR tp.nhan_vien_id IN (
    SELECT id FROM nhan_vien WHERE phong_ban_id IN (${pbIdList})
    )
    )`);
    params.push(...pbIds, ...pbIds);
  } // Admin → xem tất cả

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows]: any = await pool.query(
    `SELECT 
        tp.*, 
        nv.ho_ten,
        nv.phong_ban_id AS nv_phong_ban_id,
        pb.ten_phong_ban,
        u.ho_ten AS nguoi_tao
    FROM thuong_phat tp
    LEFT JOIN nhan_vien nv ON nv.id = tp.nhan_vien_id
    LEFT JOIN phong_ban pb ON pb.id = tp.phong_ban_id
    LEFT JOIN nhan_vien u ON u.id = tp.nguoi_tao_id
    ${whereSql}
    ORDER BY tp.ngay_tao DESC`,
    params
  );

  return { items: rows };
};

// =======================================================================
// CREATE
// =======================================================================

export const create = async (req: any) => {
  const { nhan_vien_id, phong_ban_id, loai, ly_do, so_tien, ghi_chu, thang, nam } = req.body;
  const scope = req.phamvi;
  const user = req.user;

  // 1. RÀNG BUỘC CƠ BẢN
  if (!thang || !nam) {
    return { error: "Thiếu tháng hoặc năm" };
  }

  // Phải có ít nhất 1 trong 2
  if (!nhan_vien_id && !phong_ban_id) {
    return { error: "Phải chọn nhân viên hoặc phòng ban" };
  }

  // 2. PHÂN QUYỀN THEO ROLE

  // Nhân viên tuyệt đối không được thêm
  if (scope.role === "employee") {
    return { error: "Nhân viên không thể thêm thưởng/phạt" };
  }

  // ADMIN: chỉ được thêm thưởng/phạt theo PHÒNG BAN, không gắn trực tiếp nhân viên
  if (scope.role === "admin") {
    if (!phong_ban_id) {
      return { error: "Admin chỉ được thêm thưởng/phạt theo phòng ban" };
    }
    if (nhan_vien_id) {
      return { error: "Admin không được thưởng/phạt trực tiếp từng nhân viên" };
    }
  }

  const isKeToanManager = scope.role === "manager" && scope.isAccountingManager;

  // MANAGER thường: chỉ thưởng/phạt PHÒNG BAN mình quản lý, không thưởng/phạt nhân viên
  if (scope.role === "manager" && !isKeToanManager) {
    // Nếu cố gắng thêm cho PHÒNG BAN (Khối B)
    if (!nhan_vien_id && phong_ban_id) {
      return {
        error:
          "Manager thường không được thêm thưởng/phạt trực tiếp cho phòng ban (chỉ được thêm cho nhân viên)",
      };
    }

    // Nếu thêm cho NHÂN VIÊN (Khối A)
    if (nhan_vien_id) {
      // Lấy phong_ban_id của nhân viên để kiểm tra
      const [[nv]]: any = await pool.query("SELECT phong_ban_id FROM nhan_vien WHERE id = ?", [
        nhan_vien_id,
      ]);
      const pbIdToCheck = nv?.phong_ban_id;

      if (!pbIdToCheck) {
        return { error: "Không xác định được phòng ban của nhân viên để kiểm tra quyền" };
      }

      if (!scope.managedDepartmentIds || !scope.managedDepartmentIds.includes(pbIdToCheck)) {
        return { error: "Bạn không có quyền thêm thưởng/phạt cho nhân viên thuộc phòng ban này" };
      }
    } else {
      return { error: "Manager phải chọn Nhân viên để thêm thưởng/phạt" };
    }
  }

  // MANAGER kế toán: được thêm cho NV hoặc PB, nhưng chỉ trong PB mình quản lý
  if (scope.role === "manager" && isKeToanManager) {
    let pbIdToCheck = phong_ban_id;

    // Nếu chỉ gửi nhan_vien_id mà ko gửi phong_ban_id → lấy phong_ban_id của nhân viên đó
    if (!pbIdToCheck && nhan_vien_id) {
      const [[nv]]: any = await pool.query("SELECT phong_ban_id FROM nhan_vien WHERE id = ?", [
        nhan_vien_id,
      ]);
      pbIdToCheck = nv?.phong_ban_id;
    }

    if (!pbIdToCheck) {
      return { error: "Không xác định được phòng ban để kiểm tra quyền" };
    }

    if (!scope.managedDepartmentIds.includes(pbIdToCheck)) {
      return { error: "Bạn không có quyền thêm thưởng/phạt cho phòng ban này" };
    }
  }

  // 3. CHECK KHÓA LƯƠNG (chỉ khi có nhan_vien_id)
  if (nhan_vien_id && (await isSalaryLocked(nhan_vien_id, thang, nam))) {
    return { error: "Tháng này đã trả lương — không thể thêm thưởng/phạt!" };
  }

  const nguoiTaoId = user.nhan_vien_id;
  // 4. INSERT
  const [r]: any = await pool.query(
    `INSERT INTO thuong_phat 
    (nhan_vien_id, phong_ban_id, thang, nam, loai, ly_do, so_tien, ghi_chu, nguoi_tao_id, ngay_tao)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      nhan_vien_id || null,
      phong_ban_id || null,
      thang,
      nam,
      loai,
      ly_do,
      so_tien,
      ghi_chu || null,
      nguoiTaoId,
    ]
  );

  // =============================
  // TẠO THÔNG BÁO
  // =============================
  if (nhan_vien_id) {
    // Gửi cho nhân viên
    await thongBaoService.tao({
      nguoi_nhan_id: nhan_vien_id,
      loai: "nhan_su",
      tieu_de: loai === "thuong" ? "Bạn được thưởng" : "Bạn bị phạt",
      noi_dung: `${ly_do || ""} (Số tiền: ${so_tien.toLocaleString()}đ)`,
      tham_chieu_loai: "thuong_phat",
      tham_chieu_id: r.insertId,
      nguoi_tao_id: nguoiTaoId,
    });
  } else if (phong_ban_id) {
    // Gửi cho TẤT CẢ nhân viên trong phòng ban
    const [listNV]: any = await pool.query("SELECT id FROM nhan_vien WHERE phong_ban_id = ?", [
      phong_ban_id,
    ]);

    const isThuong = loai && loai.trim().toLowerCase() === "thuong";

    for (const nv of listNV) {
      await thongBaoService.tao({
        nguoi_nhan_id: nv.id,
        loai: "nhan_su",
        tieu_de: isThuong ? "Thưởng phòng ban" : "Phạt phòng ban",
        noi_dung: `${ly_do || ""} (Số tiền: ${so_tien.toLocaleString()}đ)`,
        tham_chieu_loai: "thuong_phat",
        tham_chieu_id: r.insertId,
        nguoi_tao_id: nguoiTaoId,
      });
    }
  }

  return { id: r.insertId };
};

// =======================================================================
// REMOVE
// =======================================================================
export const remove = async (id: number, req: any) => {
  const scope = req.phamvi;
  const user = req.user;

  const [[row]]: any = await pool.query(
    "SELECT nhan_vien_id, phong_ban_id, thang, nam FROM thuong_phat WHERE id=?",
    [id]
  );

  if (!row) return { error: "Không tìm thấy" };

  // Chỉ chặn xoá khi có nhan_vien_id và đã khoá lương (thưởng/phạt NV)
  if (row.nhan_vien_id && (await isSalaryLocked(row.nhan_vien_id, row.thang, row.nam))) {
    return { error: "Tháng này đã trả lương — không thể xoá!" };
  }

  if (scope.role === "employee") {
    return { error: "Bạn không có quyền xoá" };
  }

  // Manager (kể cả kế toán) đều phải bị giới hạn trong managedDepartmentIds
  if (scope.role === "manager") {
    // Manager không được xoá thưởng/phạt phòng ban
    if (!row.nhan_vien_id && row.phong_ban_id) {
      return { error: "Manager không được xoá thưởng/phạt phòng ban" };
    }

    // ✔ Manager chỉ được xoá thưởng/phạt của nhân viên trong phòng ban quản lý
    if (row.nhan_vien_id) {
      const [[nv]]: any = await pool.query("SELECT phong_ban_id FROM nhan_vien WHERE id=?", [
        row.nhan_vien_id,
      ]);

      const pbId = nv?.phong_ban_id;

      if (!pbId || !scope.managedDepartmentIds.includes(pbId)) {
        return { error: "Bạn không có quyền xoá thưởng/phạt của nhân viên phòng ban khác" };
      }
    }
  }

  const nguoiTaoId = user.nhan_vien_id;

  // Admin: xoá được mọi bản ghi
  // =============================
  // GỬI THÔNG BÁO XOÁ
  // =============================
  if (row.nhan_vien_id) {
    await thongBaoService.tao({
      nguoi_nhan_id: row.nhan_vien_id,
      loai: "nhan_su",
      tieu_de: "Thưởng/Phạt đã bị xoá",
      noi_dung: `Một bản ghi thưởng/phạt tháng ${row.thang}/${row.nam} đã bị xoá.`,
      tham_chieu_loai: "thuong_phat",
      tham_chieu_id: id,
      nguoi_tao_id: nguoiTaoId,
    });
  } else if (row.phong_ban_id) {
    const [listNV]: any = await pool.query("SELECT id FROM nhan_vien WHERE phong_ban_id = ?", [
      row.phong_ban_id,
    ]);

    for (const nv of listNV) {
      await thongBaoService.tao({
        nguoi_nhan_id: nv.id,
        loai: "nhan_su",
        tieu_de: "Thưởng/Phạt phòng ban đã bị xoá",
        noi_dung: `Một bản ghi thưởng/phạt tháng ${row.thang}/${row.nam} của phòng ban đã bị xoá.`,
        tham_chieu_loai: "thuong_phat",
        tham_chieu_id: id,
        nguoi_tao_id: nguoiTaoId,
      });
    }
  }

  const [r]: any = await pool.query("DELETE FROM thuong_phat WHERE id=?", [id]);
  return r.affectedRows > 0 ? { ok: true } : { error: "Xoá thất bại" };
};

// =================== Hàm xuất Excel ===================
export const exportExcel = async (req: any, res: any) => {
  const scope = req.phamvi;

  // Chỉ admin hoặc manager mới được xuất
  if (!["admin", "manager"].includes(scope.role)) {
    return res.status(403).json({ error: "Không có quyền xuất Excel" });
  }

  try {
    const { items } = await getList(req);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Thuong_Phat");

    worksheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Nhân viên ID", key: "nhan_vien_id", width: 15 },
      { header: "Họ tên NV", key: "ho_ten", width: 25 },
      { header: "Phòng ban ID", key: "nv_phong_ban_id", width: 15 },
      { header: "Tên phòng ban", key: "ten_phong_ban", width: 20 },
      { header: "Loại", key: "loai", width: 10 },
      { header: "Số tiền", key: "so_tien", width: 15 },
      { header: "Lý do", key: "ly_do", width: 30 },
      { header: "Ghi chú", key: "ghi_chu", width: 30 },
      { header: "Người tạo", key: "nguoi_tao", width: 25 },
      { header: "Ngày tạo", key: "ngay_tao", width: 20 },
    ];

    items.forEach((item: any) => {
      worksheet.addRow({
        id: item.id,
        nhan_vien_id: item.nhan_vien_id,
        ho_ten: item.ho_ten,
        nv_phong_ban_id: item.nv_phong_ban_id,
        ten_phong_ban: item.ten_phong_ban,
        loai: item.loai,
        so_tien: item.so_tien,
        ly_do: item.ly_do,
        ghi_chu: item.ghi_chu,
        nguoi_tao: item.nguoi_tao,
        ngay_tao: item.ngay_tao ? new Date(item.ngay_tao).toLocaleString() : "",
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename=Thuong_Phat_${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Export Excel error:", err);
    res.status(500).json({ error: "Xuất Excel thất bại" });
  }
};
