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
  const btnApprove = $('#btn-approve'); // Duyệt
  const btnUnapprove = $('#btn-unapprove'); // Hủy duyệt

  // Mặc định ẩn các nút
  if (btnCalc) btnCalc.style.display = 'none';
  if (btnApprove) btnApprove.style.display = 'none';
  if (btnUnapprove) btnUnapprove.style.display = 'none';

  // ========= Nhân viên: chỉ xem =========
  if (role === 'employee') return;

  // ========= Manager: chỉ xem ========
  // (Không được tính lương, không được duyệt)
  if (role === 'manager') return;

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
   HIỂN THỊ 1 DÒNG LƯƠNG TRONG BẢNG
   =========================================================== */
function rowHtml(x) {
  const gross = calcGross(x);
  const net = calcNet(x);

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
      <button class="page-btn" data-act="edit" data-id="${x.id}">✏️</button>
      <button class="page-btn" data-act="del" data-id="${x.id}">🗑️</button>
    </td>
  </tr>

  <!-- ROW MỞ RỘNG -->
  <tr class="expand-row" id="expand-${x.id}">
    <td colspan="8">
      <div class="expand-box">

        <h4>I. Thành phần thu nhập</h4>
        <table>
          <tr><td>Lương thỏa thuận của tháng:</td><td>${money(
            x.luong_thoa_thuan ?? 0
          )}</td></tr>
          <tr><td>P1 – Lương theo công:</td><td>${money(
            x.luong_p1 ?? 0
          )}</td></tr>
          <tr><td>P2 – Phụ cấp:</td><td>${money(x.luong_p2 ?? 0)}</td></tr>
          <tr><td>P3 – Tăng ca / Thưởng / Phạt:</td><td>${money(
            x.luong_p3 ?? 0
          )}</td></tr>
          <tr><td><b>Tổng lương (Gross):</b></td><td><b>${money(
            gross
          )}</b></td></tr>
        </table>

        <h4>II. Các khoản khấu trừ</h4>
        <table>
          <tr><td>BHXH (8%):</td><td>${money(x.bhxh ?? 0)}</td></tr>
          <tr><td>BHYT (1.5%):</td><td>${money(x.bhyt ?? 0)}</td></tr>
          <tr><td>BHTN (1%):</td><td>${money(x.bhtn ?? 0)}</td></tr>
          <tr><td>Tổng bảo hiểm:</td><td>${money(x.tong_bh ?? 0)}</td></tr>
          <tr><td>Thuế TNCN:</td><td>${money(x.thue_tncn ?? 0)}</td></tr>
          <tr><td><b>Lương thực nhận (Net):</b></td><td><b>${money(
            net
          )}</b></td></tr>
        </table>

        <h4>III. Công – Nghỉ – Tăng ca</h4>
        <table>
          <tr><td>Số ngày công:</td><td>${esc(x.so_ngay_cong ?? 0)}</td></tr>
          <tr><td>Nghỉ phép:</td><td>${esc(x.so_ngay_nghi_phep ?? 0)}</td></tr>
          <tr><td>Nghỉ lễ hưởng lương:</td><td>${esc(
            x.so_ngay_le ?? 0
          )}</td></tr>
          <tr><td>Giờ tăng ca:</td><td>${esc(x.gio_tang_ca ?? 0)}</td></tr>
        </table>

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
  const res = await api('/cham-cong/phong-ban/list');
  const items = res.items || res.data?.items || [];
  const sel = $('#filter-phong-ban');

  sel.innerHTML =
    '<option value="">Tất cả phòng ban</option>' +
    items
      .map((x) => `<option value="${x.id}">${esc(x.ten_phong_ban)}</option>`)
      .join('');
}

async function loadNhanVien() {
  const res = await api('/nhan-vien?limit=1000');
  const items = res.data?.items || [];
  const sel = $('#filter-nhan-vien');

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
// ẨN/HIỆN NÚT EDIT + DELETE TRONG BẢNG
// ============================
function updateEditDeleteButtons(state) {
  const isLocked = state === 'da_duyet';

  document.querySelectorAll('#tbody .salary-row').forEach((tr) => {
    const editBtn = tr.querySelector('button[data-act="edit"]');
    const delBtn = tr.querySelector('button[data-act="del"]');

    if (!editBtn || !delBtn) return;

    if (isLocked) {
      editBtn.style.display = 'none';
      delBtn.style.display = 'none';
    } else {
      editBtn.style.display = '';
      delBtn.style.display = '';
    }
  });
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
      await api(`/luong/tinh-thang?thang=${thang}&nam=${nam}`, {
        method: 'POST',
      });
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

    if (act === 'edit') return openModal(row);

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
    loadApproveState($('#thang').value, $('#nam').value); // ⭐ THÊM
  });

  $('#nam').addEventListener('change', () => {
    fetchList();
    loadApproveState($('#thang').value, $('#nam').value); // ⭐ THÊM
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
