//luong.js
import {
  api,
  getUser,
  getToken,
  clearAuth,
  requireAuthOrRedirect,
} from './api.js';

const st = { page: 1, limit: 10, total: 0, items: [], editingId: null };

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) =>
  (s ?? '').toString().replace(
    /[&<>"']/g,
    (m) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      }[m])
  );
const money = (v) =>
  (v == null ? 0 : Number(v)).toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
  });

function unwrap(r) {
  const d = r?.data ?? r;
  if (Array.isArray(d)) return { items: d, total: d.length };
  if (d?.items) return { items: d.items, total: d.total ?? d.items.length };
  if (d?.rows) return { items: d.rows, total: d.rows.length };
  return { items: d?.list ?? [], total: d?.total ?? 0 };
}

function setUserBadge() {
  const b = $('#user-badge');
  const u = getUser();

  if (!b) return;

  // ============ CHƯA ĐĂNG NHẬP ============
  if (!u) {
    b.className = 'badge badge-warn';
    b.textContent = 'Chưa đăng nhập';
    return;
  }

  // Lấy role từ backend
  const role = u.role ?? 'employee';

  // ===== Tạo nhãn hiển thị =====
  // Ưu tiên dùng chức vụ (chuc_vu), nếu không có thì dùng role
  let roleLabel = '';

  if (role === 'admin') {
    roleLabel = 'Admin';
  } else if (role === 'manager') {
    roleLabel = u.chuc_vu || 'Manager'; // nếu có chức vụ sẽ hiện Giám đốc, Kế toán trưởng…
  } else {
    roleLabel = u.chuc_vu || 'Nhân viên';
  }

  b.className = 'badge badge-ok';
  b.textContent = `${u.username} • ${roleLabel}`;

  // ========== Phân quyền giao diện ==========
  const btnCalc = $('#btn-calc'); // Tính lương
  const btnApprove = $('#btn-toggle-duyet'); // Duyệt
  const btnUnapprove = $('#btn-toggle-duyet'); // Hủy duyệt

  // Mặc định ẩn các nút
  if (btnCalc) btnCalc.style.display = 'none';
  if (btnApprove) btnApprove.style.display = 'none';
  if (btnUnapprove) btnUnapprove.style.display = 'none';

  // ========= Manager KẾ TOÁN → giống Admin ========
  if (role === 'manager' && u.isAccountingManager) {
    if (btnCalc) btnCalc.style.display = 'inline-block';
    if (btnApprove) btnApprove.style.display = 'none';
    if (btnUnapprove) btnUnapprove.style.display = 'none';
    return;
  }

  // ========= Admin: toàn quyền ========
  if (role === 'admin') {
    if (btnCalc) btnCalc.style.display = 'inline-block';
    if (btnApprove) btnApprove.style.display = 'inline-block';
    if (btnUnapprove) btnUnapprove.style.display = 'inline-block';
  }
}

function calcGross(x) {
  return (
    Number(x.luong_p1 ?? x.luong_thoa_thuan ?? 0) +
    Number(x.luong_p2 ?? 0) +
    Number(x.luong_p3 ?? 0)
  );
}

function calcNet(x) {
  const gross = calcGross(x);
  return gross - Number(x.tong_bh ?? 0) - Number(x.thue_tncn ?? 0);
}

/* ===========================================================
   HIỂN THỊ 1 DÒNG LƯƠNG TRONG BẢNG - RÚT GỌN & BỔ SUNG
   =========================================================== */
function moneyShort(v) {
  const num = Number(v);
  if (isNaN(num)) return '';
  // Sử dụng toLocaleString để có dấu phẩy, sau đó thêm 'đ'
  return num.toLocaleString('vi-VN') + 'đ';
}

function getMaxBHXHBase(thang, nam) {
  const date = new Date(nam, thang - 1, 1);
  // Ví dụ: Từ 01/07/2025, mức trần là 50 triệu
  return date >= new Date(2025, 6, 1) ? 50_000_000 : 46_800_000;
}

function getStandardWorkingDays(month, year) {
  const daysInMonth = new Date(year, month, 0).getDate();
  let workingDays = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay(); // 0 = Chủ nhật, 1 = Thứ hai, ..., 6 = Thứ bảy
    if (dayOfWeek !== 0) {
      // Chỉ tính các ngày từ Thứ Hai đến Thứ Bảy
      workingDays++;
    }
  }
  return workingDays;
}

function rowHtml(x) {
  const gross = calcGross(x);
  const net = calcNet(x);

  // Lấy dữ liệu từ backend
  const thangNum = Number(x.thang || 0);
  const namNum = Number(x.nam || 0);
  const soCongChuan =
    thangNum && namNum ? getStandardWorkingDays(thangNum, namNum) : 0;
  const luongThoaThuan = Number(x.luong_thoa_thuan || 0);
  const soNgayCong = Number(x.so_ngay_cong || 0);
  const soNgayPhep = Number(x.so_ngay_nghi_phep || 0);
  const soNgayLe = Number(x.so_ngay_nghi_huong_luong || x.so_ngay_le || 0);
  const gioTangCa = Number(x.gio_tang_ca || 0);
  const mucLuongCoBan = Number(x.muc_luong_co_ban || 0);
  const tongPhuCapDongBH = Number(x.tong_phu_cap_dong_bh || 0);
  const soNgayCongThuc = Number(x.ngay_cong_lam || 0);
  const soNguoiPhuThuoc = Number(x.so_nguoi_phu_thuoc || 0);

  // Các giá trị cơ sở để hiển thị
  const mucDongBHXH = Math.min(
    mucLuongCoBan + tongPhuCapDongBH,
    getMaxBHXHBase(thangNum, namNum)
  );

  return `
  <tr class="salary-row" data-id="${x.id}">
    <td>${x.id}</td>
    <td>${esc(x.ho_ten || '')}</td>
    <td>${money(gross)}</td>
    <td class="salary-net">${money(net)}</td>
    <td>${esc(x.thang)}/${esc(x.nam)}</td>
    <td>${money(x.bhxh ?? 0)}</td>
    <td>${money(x.thue_tncn ?? 0)}</td>
    <td>
      <button class="page-btn" data-act="expand" data-id="${x.id}">▼</button>
    </td>
  </tr>

  <!-- ROW MỞ RỘNG -->
  <tr class="expand-row" id="expand-${x.id}">
    <td colspan="8">
      <div class="expand-box">

        <!-- BỐ CỤC 2 CỘT CHO 2 PHẦN ĐẦU -->
        <div class="salary-grid">
          
          <!-- I. THÀNH PHẦN THU NHẬP -->
          <div class="salary-section">
            <h4>I. Thành phần thu nhập</h4>
            <div class="salary-item">
              <span class="label">Lương thỏa thuận:</span>
              <span>${money(luongThoaThuan)}</span>
            </div>
            <div class="salary-item">
              <span class="label">Lương cơ bản:</span>
              <span>${money(mucLuongCoBan)}</span>
            </div>
            <div class="salary-item">
              <span class="label">Phụ cấp đóng BH:</span>
              <span>${money(tongPhuCapDongBH)}</span>
            </div>
            <div class="salary-item">
              <span class="label">P1 – Lương theo công:</span>
              <span>${money(x.luong_p1 ?? 0)}</span>
            </div>
            <div class="salary-item">
              <span class="label">P2 – Phụ cấp:</span>
              <span>${money(x.luong_p2 ?? 0)}</span>
            </div>
            <div class="salary-item">
              <span class="label">P3 – Tăng ca / Thưởng / Phạt:</span>
              <span>${money(x.luong_p3 ?? 0)}</span>
            </div>
            <div class="salary-item">
              <span class="label"><b>Tổng lương (Gross):</b></span>
              <span><b>${money(gross)}</b></span>
            </div>
            <div class="formula-note">
              <b>Công thức chung:</b><br>
              P1 = (Số ngày công + Nghỉ phép + Nghỉ lễ) × (Lương thỏa thuận / Công chuẩn tháng)<br>
              P3 = (Tiền tăng ca) + (Thưởng) - (Phạt)
            </div>
          </div>

          <!-- II. CÁC KHOẢN KHẤU TRỪ - BỔ SUNG THEO BẢN CŨ -->
          <div class="salary-section">
            <h4>II. Các khoản khấu trừ</h4>
            
            <!-- Bổ sung: Cơ sở tính BHXH -->
            <div class="salary-item">
              <span class="label">Cơ sở tính BH (Lương CB + PC đóng BH):</span>
              <span>${money(mucDongBHXH)}</span>
            </div>
            
            <!-- Các khoản bảo hiểm - BỔ SUNG TỪ BẢN CŨ -->
            <div class="salary-item">
              <span class="label">BHXH (8%):</span>
              <span>${money(x.bhxh ?? 0)}</span>
            </div>
            <div class="salary-item">
              <span class="label">BHYT (1.5%):</span>
              <span>${money(x.bhyt ?? 0)}</span>
            </div>
            <div class="salary-item">
              <span class="label">BHTN (1%):</span>
              <span>${money(x.bhtn ?? 0)}</span>
            </div>
            <div class="salary-item">
              <span class="label">Tổng bảo hiểm:</span>
              <span>${money(x.tong_bh ?? 0)}</span>
            </div>
            
            <!-- Thuế TNCN -->
            <div class="salary-item">
              <span class="label">Thuế TNCN:</span>
              <span>${money(x.thue_tncn ?? 0)}</span>
            </div>
            
            <div class="salary-item">
              <span class="label"><b>Lương thực nhận (Net):</b></span>
              <span><b>${money(net)}</b></span>
            </div>
            
            <div class="formula-note">
              <b>Công thức chung:</b><br>
              BHXH = Cơ sở tính BH × 8%<br>
              Thuế TNCN = (Gross - Tổng BH - Giảm trừ bản thân 11M - Giảm trừ phụ thuộc) × Thuế suất
            </div>
          </div>
        </div>

        <!-- III. CÔNG – NGHỈ – TĂNG CA -->
        <div class="salary-section" style="margin-top: 16px;">
          <h4>III. Công – Nghỉ – Tăng ca</h4>
          <div class="work-info-grid">
            <div class="salary-item" style="border: none;">
              <span class="label">Số ngày công:</span>
              <span>${esc(soNgayCong)}</span>
            </div>
            <div class="salary-item" style="border: none;">
              <span class="label">Số ngày công thực:</span>
              <span>${esc(soNgayCongThuc)}</span>
            </div>
            <div class="salary-item" style="border: none;">
              <span class="label">Nghỉ phép:</span>
              <span>${esc(soNgayPhep)}</span>
            </div>
            <div class="salary-item" style="border: none;">
              <span class="label">Nghỉ lễ hưởng lương:</span>
              <span>${esc(soNgayLe)}</span>
            </div>
            <div class="salary-item" style="border: none;">
              <span class="label">Giờ tăng ca:</span>
              <span>${esc(gioTangCa)}</span>
            </div>
            <div class="salary-item" style="border: none; grid-column: 1 / -1;">
              <span class="label">Công chuẩn tháng:</span>
              <span>${esc(soCongChuan)} ngày (không tính Chủ nhật)</span>
            </div>
          </div>
        </div>

      </div>
    </td>
  </tr>
  `;
}

/* ===========================================================
   FETCH LIST
   =========================================================== */
async function fetchList() {
  const qs = new URLSearchParams({
    page: String(st.page),
    limit: String(st.limit),
  });

  // ====== LẤY GIÁ TRỊ TỪ GIAO DIỆN ======
  const thang = $('#thang').value;
  const nam = $('#nam').value;
  const phongBan = $('#filter-phong-ban')?.value || '';
  const nhanVien = $('#filter-nhan-vien')?.value || '';

  // ====== GHÉP PARAM LỌC ======
  if (thang) qs.set('thang', thang);
  if (nam) qs.set('nam', nam);

  // Lọc phòng ban
  if (phongBan) qs.set('phong_ban_id', phongBan);

  // Lọc nhân viên
  if (nhanVien) qs.set('nhan_vien_id', nhanVien);

  // ====== LẤY TRẠNG THÁI DUYỆT LƯƠNG ======
  const approveState = await loadApproveState(thang, nam);
  updateEditDeleteButtons(approveState);

  // ====== GỌI API ======
  const resp = await api(`/luong?${qs.toString()}`).catch(() => ({ data: [] }));
  const { items, total } = unwrap(resp);

  st.items = items ?? [];
  st.total = total ?? 0;

  // ====== HIỂN THỊ LÊN BẢNG ======
  const tbody = $('#tbody');
  tbody.innerHTML = st.items.length
    ? st.items.map(rowHtml).join('')
    : `<tr><td colspan="10" class="text-muted">Không có dữ liệu</td></tr>`;

  pageInfo();
}

function pageInfo() {
  const totalPages = Math.max(1, Math.ceil(st.total / st.limit));
  $('#pageInfo').textContent = `Trang ${st.page}/${totalPages}`;

  // Ẩn hoặc hiện nút phân trang
  $('#prev').disabled = st.page <= 1;
  $('#next').disabled = st.page >= totalPages;
}

async function loadPhongBan() {
  const u = getUser();
  const sel = $('#filter-phong-ban');

  // ---- Admin hoặc Manager kế toán → xem toàn bộ ----
  if (u.role === 'admin' || u.isAccountingManager) {
    const res = await api('/cham-cong/phong-ban/list');
    const items = res.items || res.data?.items || [];

    sel.innerHTML =
      '<option value="">Tất cả phòng ban</option>' +
      items
        .map((x) => `<option value="${x.id}">${esc(x.ten_phong_ban)}</option>`)
        .join('');
    return;
  }

  // ---- Manager thường → chỉ xem phòng mình ----
  const managed = u.managedDepartmentIds || [];

  if (managed.length === 0) {
    sel.innerHTML = `<option value="">(Không có phòng ban nào)</option>`;
    return;
  }

  // Tải full để lọc FE (đỡ phải tạo route mới)
  const res = await api('/cham-cong/phong-ban/list');
  const items = (res.items || []).filter((x) => managed.includes(x.id));

  sel.innerHTML =
    '<option value="">Tất cả phòng ban</option>' +
    items
      .map((x) => `<option value="${x.id}">${esc(x.ten_phong_ban)}</option>`)
      .join('');
}

async function loadNhanVien() {
  const u = getUser();
  const sel = $('#filter-nhan-vien');

  // ---- Admin hoặc Manager kế toán → xem toàn bộ nhân viên ----
  if (u.role === 'admin' || u.isAccountingManager) {
    const res = await api('/nhan-vien?limit=1000');
    const items = res.data?.items || [];

    sel.innerHTML =
      '<option value="">Tất cả nhân viên</option>' +
      items
        .map((x) => `<option value="${x.id}">${esc(x.ho_ten)}</option>`)
        .join('');
    return;
  }

  // ---- Manager thường → nhân viên thuộc phòng ban mình ----
  const managed = u.managedDepartmentIds || [];

  if (managed.length === 0) {
    sel.innerHTML = `<option value="">(Không có nhân viên)</option>`;
    return;
  }

  const res = await api('/nhan-vien?limit=1000');
  const items = (res.data?.items || []).filter((x) =>
    managed.includes(x.phong_ban_id)
  );

  sel.innerHTML =
    '<option value="">Tất cả nhân viên</option>' +
    items
      .map((x) => `<option value="${x.id}">${esc(x.ho_ten)}</option>`)
      .join('');
}

/* ===========================================================
   MODAL
   =========================================================== */
function openModal(row = null) {
  st.editingId = row?.id ?? null;

  $('#modal-title').textContent = row
    ? `Sửa bản lương #${row.id}`
    : 'Thêm bản lương';

  $('#nhan_vien_id').value = row?.nhan_vien_id ?? '';
  $('#luong_co_ban').value = row?.luong_p1 ?? row?.luong_thoa_thuan ?? '';
  $('#he_so_luong').value = row?.he_so_luong ?? 1;
  $('#tong_gio_lam').value = row?.tong_gio_lam ?? 0;
  $('#gio_tang_ca').value = row?.gio_tang_ca ?? 0;
  $('#phu_cap').value = row?.luong_p2 ?? 0;
  $('#thuong').value = row?.luong_p3 ?? 0;
  $('#khau_tru').value = row?.tong_bh ?? 0;

  if (row?.nam && row?.thang)
    $('#thang_nam').value = `${row.nam}-${String(row.thang).padStart(2, '0')}`;
  else $('#thang_nam').value = '';

  $('#ghi_chu').value = row?.ghi_chu ?? '';

  $('#modal-error').hidden = true;
  $('#modal').showModal();
}

function closeModal() {
  $('#modal').close();
}

function showErr(m) {
  const el = $('#modal-error');
  el.hidden = false;
  el.textContent = m;
}

/* ===========================================================
   LƯU BẢN LƯƠNG THỦ CÔNG
   =========================================================== */
async function onSave(e) {
  e.preventDefault();
  $('#modal-error').hidden = true;

  const [nam, thang] = $('#thang_nam').value.split('-').map(Number);

  const payload = {
    nhan_vien_id: Number($('#nhan_vien_id').value),
    thang,
    nam,
    luong_thoa_thuan: Number($('#luong_co_ban').value || 0),
    luong_p2: Number($('#phu_cap').value || 0),
    luong_p3: Number($('#thuong').value || 0),
    ghi_chu: $('#ghi_chu').value.trim() || null,
  };

  if (!payload.nhan_vien_id || !payload.thang || !payload.nam)
    return showErr('Vui lòng nhập đầy đủ thông tin.');

  try {
    if (st.editingId)
      await api(`/luong/${st.editingId}`, { method: 'PUT', body: payload });
    else await api('/luong', { method: 'POST', body: payload });

    closeModal();
    await fetchList();
  } catch (err) {
    showErr(err?.message || 'Lưu thất bại');
  }
}

// ============================
// CẬP NHẬT NÚT DELETE THEO PHÂN QUYỀN
// ============================
function updateEditDeleteButtons(state) {
  const u = getUser();
  const isLocked = state === 'da_duyet';

  document.querySelectorAll('#tbody .salary-row').forEach((tr) => {
    const delBtn = tr.querySelector('button[data-act="del"]');

    if (!delBtn) return;

    // Nhân viên & manager thường → không được sửa/xóa
    if (
      u.role === 'employee' ||
      (u.role === 'manager' && !u.isAccountingManager)
    ) {
      delBtn.style.display = 'none';
      return;
    }

    // Admin hoặc Manager kế toán
    if (isLocked) {
      delBtn.style.display = 'none';
    } else {
      delBtn.style.display = '';
    }
  });
}

// ============================
// CẬP NHẬT NÚT DUYỆT / HỦY DUYỆT
// ============================
function updateDuyetButton(state) {
  const btn = document.getElementById('btn-toggle-duyet');
  if (!btn) return;

  if (state === 'da_duyet') {
    btn.textContent = 'Hủy duyệt';
    btn.classList.remove('btn-success');
    btn.classList.add('btn-warn');
  } else {
    btn.textContent = 'Duyệt lương';
    btn.classList.remove('btn-warn');
    btn.classList.add('btn-success');
  }
}

// ============================
// LẤY TRẠNG THÁI DUYỆT HIỆN TẠI
// ============================
async function loadApproveState(thang, nam) {
  try {
    const res = await api(`/luong?thang=${thang}&nam=${nam}`);
    const items = res?.data?.items ?? res.items ?? [];

    let state = 'chua_duyet';

    if (items.length) {
      state = items[0].trang_thai_duyet ?? 'chua_duyet';
    }

    updateDuyetButton(state);
    return state;
  } catch (err) {
    console.warn('Không thể tải trạng thái duyệt:', err);
    return 'chua_duyet';
  }
}

/* ===========================================================
   BIND SỰ KIỆN
   =========================================================== */
function bind() {
  $('#btn-refresh').addEventListener('click', () => {
    fetchList();
    loadApproveState($('#thang').value, $('#nam').value); // ⭐ THÊM
  });
  $('#btn-search').addEventListener('click', () => {
    st.page = 1;
    fetchList();
    loadApproveState($('#thang').value, $('#nam').value); // ⭐ THÊM DÒNG NÀY
  });

  $('#filter-phong-ban').addEventListener('change', () => {
    st.page = 1;
    fetchList();
  });

  $('#filter-nhan-vien').addEventListener('change', () => {
    st.page = 1;
    fetchList();
  });

  // ===== TÍNH LƯƠNG =====
  $('#btn-calc').addEventListener('click', async () => {
    const thang = $('#thang').value;
    const nam = $('#nam').value;
    if (!thang || !nam) return alert('Vui lòng chọn Tháng/Năm');

    if (!confirm(`Bạn chắc muốn tính lương tháng ${thang}/${nam}?`)) return;

    try {
      const pb = $('#filter-phong-ban').value || '';
      const nv = $('#filter-nhan-vien').value || '';

      await api(
        `/luong/tinh-thang?thang=${thang}&nam=${nam}&phong_ban_id=${pb}&nhan_vien_id=${nv}`,
        { method: 'POST' }
      );
      await fetchList();
      alert(`Đã tính lương tháng ${thang}/${nam}`);
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Lỗi không xác định';

      alert('❌ ' + msg);
    }
  });

  // ===== DUYỆT / HỦY DUYỆT =====
  document
    .getElementById('btn-toggle-duyet')
    .addEventListener('click', async () => {
      const thang = $('#thang').value;
      const nam = $('#nam').value;

      if (!thang || !nam) {
        alert('Vui lòng chọn tháng và năm!');
        return;
      }

      try {
        const res = await api('/luong/toggle-duyet', {
          method: 'POST',
          body: { thang, nam },
        });

        // Nếu BE trả về error (ví dụ: đã trả 1 phần hoặc trả hết)
        if (res.error) {
          alert('❌ ' + res.error);
          return;
        }

        alert(res.message);

        // cập nhật nút theo trạng thái mới trả về từ BE
        updateDuyetButton(res.state);

        // reload bảng
        fetchList();
      } catch (err) {
        alert('Lỗi duyệt lương: ' + (err?.message || err));
      }
    });

  // ===== XỬ LÝ CLICK TRONG BẢNG =====
  $('#tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;

    const id = btn.dataset.id;
    const act = btn.dataset.act;
    const row = st.items.find((x) => String(x.id) === String(id));

    // Mở rộng/thu gọn
    if (act === 'expand') {
      const rowEl = $(`#expand-${id}`);
      rowEl.classList.toggle('active');
      btn.textContent = rowEl.classList.contains('active') ? '▲' : '▼';
      return;
    }

    if (act === 'del') {
      if (!confirm(`Xóa bản lương #${id}?`)) return;
      try {
        await api(`/luong/${id}`, { method: 'DELETE' });
        await fetchList();
      } catch (err) {
        alert('Không thể xóa: ' + err?.message);
      }
    }
  });

  $('#btn-cancel').addEventListener('click', closeModal);
  $('#form').addEventListener('submit', onSave);

  // ===== PHÂN TRANG =====
  $('#prev').addEventListener('click', () => {
    if (st.page > 1) st.page--;
    fetchList();
  });
  $('#next').addEventListener('click', () => {
    st.page++;
    fetchList();
  });

  $('#thang').addEventListener('change', () => {
    fetchList();
    loadApproveState($('#thang').value, $('#nam').value);
  });

  $('#nam').addEventListener('change', () => {
    fetchList();
    loadApproveState($('#thang').value, $('#nam').value);
  });
}

/* ===========================================================
   INIT
   =========================================================== */
async function init() {
  requireAuthOrRedirect('./dang-nhap.html');
  if (!getToken()) return;

  $('#y').textContent = new Date().getFullYear();
  setUserBadge();
  setupMonthYearSelect();

  await loadPhongBan();
  await loadNhanVien();

  await fetchList();
  await loadApproveState($('#thang').value, $('#nam').value);
  bind();
}

document.addEventListener('DOMContentLoaded', init);

function setupMonthYearSelect() {
  const thangSelect = $('#thang');
  const yearInput = $('#nam');
  if (!thangSelect) return;

  for (let i = 1; i <= 12; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `Tháng ${i}`;
    thangSelect.appendChild(opt);
  }

  const now = new Date();
  thangSelect.value = now.getMonth() + 1;
  yearInput.value = now.getFullYear();
}
