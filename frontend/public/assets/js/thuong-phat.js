// thuong-phat.js (FULL CODE ĐÃ CHỈNH SỬA)
// === THƯỞNG / PHẠT ===
import { api } from './api.js';

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

// ===== PHÂN QUYỀN FRONTEND =====
const USER = JSON.parse(localStorage.getItem('hr_user') || '{}');
const ROLE = (USER?.role || 'employee').toLowerCase();
const IS_ADMIN = ROLE === 'admin';
const IS_MANAGER = ROLE === 'manager';
const IS_EMPLOYEE = ROLE === 'employee';
const IS_ACC_MANAGER = USER?.isAccountingManager === true;

// ===== PHÂN TRANG =====
const stTP = {
  page: 1,
  limit: 10,
  total: 0,
  items: [],
};

const money = (v) => Number(v ?? 0).toLocaleString('vi-VN');
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('vi-VN') : '');

// ==== STATE ====
const st = {
  nhanVienList: [],
  phongBanList: [],
  selectedNhanVienId: null,
  filters: { thang: '', nam: '', nhan_vien_id: '', phong_ban_id: '' },
};

// ==== LẤY DỮ LIỆU NHÂN VIÊN ====
async function fetchNhanVienList() {
  try {
    const res = await api('/nhan-vien?limit=1000');
    st.nhanVienList = res?.data?.items || res?.items || [];
  } catch (e) {
    st.nhanVienList = [];
  }
}

function renderThuongPhatTable() {
  const start = (stTP.page - 1) * stTP.limit;
  const end = start + stTP.limit;
  const rows = stTP.items.slice(start, end);

  $('#tbody-tp').innerHTML = rows.length
    ? rows
        .map(
          (x) => `
      <tr>
        <td>${x.id}</td>
        <td>${esc(x.ho_ten ?? '')}</td>
        <td>${esc(x.loai)}</td>
        <td>${money(x.so_tien)}</td>
        <td>${esc(x.ly_do ?? '')}</td>
        <td>${fmtDate(x.ngay_tao)}</td>
        <td>${esc(x.nguoi_tao ?? '')}</td>
        <td>
          ${
            IS_EMPLOYEE
              ? ''
              : IS_ADMIN ||
                IS_ACC_MANAGER ||
                (IS_MANAGER &&
                  USER.managedDepartmentIds?.includes(x.phong_ban_id))
              ? `<button class="page-btn" data-act="del" data-id="${x.id}">🗑️</button>`
              : ''
          }
        </td>

      </tr>
    `
        )
        .join('')
    : `<tr><td colspan="8" class="text-muted">Không có dữ liệu</td></tr>`;

  // ===== CẬP NHẬT PHÂN TRANG =====
  stTP.total = stTP.items.length;
  const totalPages = Math.max(1, Math.ceil(stTP.total / stTP.limit));

  $('#tp-pageInfo').textContent = `Trang ${stTP.page}/${totalPages}`;
  $('#tp-prev').disabled = stTP.page <= 1;
  $('#tp-next').disabled = stTP.page >= totalPages;
}

// ==== GỢI Ý NHÂN VIÊN ====
function setupNhanVienTypeahead() {
  if ($('#tp-search-wrap')) return;
  const toolbar = $('#thuong-phat-toolbar');

  const wrap = document.createElement('span');
  wrap.id = 'tp-search-wrap';
  wrap.style.position = 'relative';
  wrap.style.marginRight = '8px';
  wrap.innerHTML = `
    <input id="tp-nv-search" placeholder="Tìm nhân viên (Tên/ID)" style="width:200px" autocomplete="off"/>
    <div id="tp-nv-dropdown" style="display:none;position:absolute;left:0;right:0;top:34px;background:#fff;border:1px solid #ccc;border-radius:6px;max-height:220px;overflow:auto;z-index:1000"></div>
  `;
  const chip = document.createElement('span');
  chip.id = 'tp-nv-chip';
  chip.style.display = 'none';
  chip.style.marginRight = '8px';
  chip.style.background = '#eef5ff';
  chip.style.border = '1px solid #b6d3ff';
  chip.style.padding = '4px 8px';
  chip.style.borderRadius = '16px';
  chip.innerHTML = `<span id="tp-nv-chip-text"></span> <button id="tp-nv-chip-clear" type="button" style="margin-left:6px;border:none;background:transparent;cursor:pointer">❌</button>`;

  toolbar.prepend(chip);
  toolbar.prepend(wrap);

  const input = $('#tp-nv-search');
  const list = $('#tp-nv-dropdown');

  function render(items) {
    list.innerHTML = items
      .map(
        (nv) =>
          `<div data-id="${nv.id}" style="padding:6px 10px;cursor:pointer">#${
            nv.id
          } — ${esc(nv.ho_ten)}</div>`
      )
      .join('');
    list.style.display = 'block';
  }

  function filter(q) {
    const kw = q.trim().toLowerCase();
    return st.nhanVienList
      .filter(
        (nv) =>
          String(nv.id).includes(kw) ||
          (nv.ho_ten || '').toLowerCase().includes(kw)
      )
      .slice(0, 50);
  }

  input.addEventListener('input', () => render(filter(input.value)));
  input.addEventListener('focus', () => render(filter(input.value)));

  list.addEventListener('click', (e) => {
    const item = e.target.closest('[data-id]');
    if (!item) return;
    st.selectedNhanVienId = Number(item.dataset.id);
    const nv = st.nhanVienList.find((x) => x.id === st.selectedNhanVienId);
    $('#tp-nv-chip-text').textContent = nv
      ? `${nv.ho_ten} (#${nv.id})`
      : `#${st.selectedNhanVienId}`;
    $('#tp-nv-chip').style.display = 'inline-flex';
    $('#tp-search-wrap').style.display = 'none';
    list.style.display = 'none';
  });

  $('#tp-nv-chip-clear').addEventListener('click', () => {
    st.selectedNhanVienId = null;
    $('#tp-nv-chip').style.display = 'none';
    $('#tp-search-wrap').style.display = 'inline-block';
  });
}

// ==== PHÒNG BAN ====
async function loadPhongBan() {
  try {
    const res = await api('/cham-cong/phong-ban/list');
    st.phongBanList = res?.items || res?.data?.items || [];
    const sel = document.createElement('select');
    sel.id = 'tp-phong-ban';
    sel.innerHTML =
      `<option value="">-- Tất cả phòng ban --</option>` +
      st.phongBanList
        .map((x) => `<option value="${x.id}">${esc(x.ten_phong_ban)}</option>`)
        .join('');
    $('#thuong-phat-toolbar').insertBefore(sel, $('#btn-tp-add'));
  } catch (e) {
    console.warn('Không tải được phòng ban');
  }
}

// ==== DANH SÁCH ====
async function fetchList() {
  try {
    // ⭐ ĐÃ SỬA: Tự động gán phong_ban_id của user vào bộ lọc nếu là employee
    if (IS_EMPLOYEE && USER?.phong_ban_id) {
      st.filters.phong_ban_id = USER.phong_ban_id;
    }

    const { thang, nam, nhan_vien_id, phong_ban_id } = st.filters;
    const q = new URLSearchParams();
    if (thang) q.append('thang', thang);
    if (nam) q.append('nam', nam);
    // Gửi nhan_vien_id chỉ khi người dùng nhập vào thanh tìm kiếm (manager/admin)
    if (nhan_vien_id) q.append('nhan_vien_id', nhan_vien_id);
    // Gửi phong_ban_id (sẽ là ID cố định của employee, hoặc ID do manager/admin chọn)
    if (phong_ban_id) q.append('phong_ban_id', phong_ban_id);

    const res = await api(`/thuong-phat?${q.toString()}`);
    const rows = res?.items || res?.data?.items || [];

    stTP.items = rows;
    stTP.page = 1;

    renderThuongPhatTable();
  } catch (e) {
    console.error('Lỗi khi tải thưởng phạt:', e);
    $(
      '#tbody-tp'
    ).innerHTML = `<tr><td colspan="8" class="text-danger">Lỗi server</td></tr>`;
  }
}

// ==== THÊM & XOÁ ====
async function addTP() {
  const phong_ban_id = Number($('#tp-phong-ban')?.value || '') || null;
  const nhan_vien_id = st.selectedNhanVienId || null;
  if (!nhan_vien_id && !phong_ban_id)
    return alert('Vui lòng chọn nhân viên hoặc phòng ban');

  const loai = $('#tp-loai').value;
  const so_tien = Number($('#tp-so-tien').value || 0);
  const ly_do = $('#tp-ly-do').value || '';

  const thang = $('#tp-thang').value;
  const nam = $('#tp-nam').value;

  if (!thang || !nam) return alert('Vui lòng chọn tháng và năm');
  if (!so_tien) return alert('Số tiền không hợp lệ');

  await api('/thuong-phat', {
    method: 'POST',
    body: { nhan_vien_id, phong_ban_id, loai, so_tien, ly_do, thang, nam },
  });

  $('#tp-so-tien').value = '';
  $('#tp-ly-do').value = '';

  await fetchList();
}

async function delTP(id) {
  if (!confirm('Xoá bản ghi này?')) return;
  await api(`/thuong-phat/${id}`, { method: 'DELETE' });
  await fetchList();
}

// ==== LỌC & XUẤT ====
function setupFilters() {
  $('#tp-thang').addEventListener('change', (e) => {
    st.filters.thang = e.target.value;
    fetchList();
  });
  $('#tp-nam').addEventListener('change', (e) => {
    st.filters.nam = e.target.value;
    fetchList();
  });
  // Nhân viên vẫn có thể kích hoạt fetchList, nhưng select đã bị disabled
  $('#tp-phong-ban').addEventListener('change', (e) => {
    st.filters.phong_ban_id = e.target.value;
    fetchList();
  });
  $('#btn-filter-nv').addEventListener('click', () => {
    st.filters.nhan_vien_id = st.selectedNhanVienId || '';
    fetchList();
  });
  $('#btn-export-tp').addEventListener('click', exportExcel);
}

async function exportExcel() {
  const { thang, nam, nhan_vien_id, phong_ban_id } = st.filters;
  const q = new URLSearchParams();
  if (thang) q.append('thang', thang);
  if (nam) q.append('nam', nam);
  if (nhan_vien_id) q.append('nhan_vien_id', nhan_vien_id);
  if (phong_ban_id) q.append('phong_ban_id', phong_ban_id);
  window.open(`/api/thuong-phat/export?${q.toString()}`, '_blank');
}

// ==== KHỞI TẠO ====
document.addEventListener('DOMContentLoaded', () => {
  // ===== ẨN / HIỆN NÚT THÊM THEO QUYỀN =====
  const addBtn = $('#btn-tp-add');

  if (IS_EMPLOYEE) {
    addBtn.style.display = 'none';
  } else if (IS_ADMIN || IS_ACC_MANAGER) {
    addBtn.style.display = 'inline-block';
  } else if (IS_MANAGER) {
    addBtn.style.display = 'inline-block'; // nhưng backend sẽ chặn nếu khác phòng ban
  }

  // ⭐⭐ NHÂN VIÊN → KHÔNG ĐƯỢC ĐỔI PHÒNG BAN ⭐⭐
  if (IS_EMPLOYEE) {
    const pbSelect = $('#tp-phong-ban');
    if (pbSelect) {
      // Set cố định ID phòng ban của họ (đã fix trong fetchList)
      pbSelect.value = USER.phong_ban_id;
      pbSelect.disabled = true;
    }
  }

  // ---- Sinh danh sách tháng ----
  const thangSelect = document.getElementById('tp-thang');
  if (thangSelect) {
    for (let i = 1; i <= 12; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = i;
      thangSelect.appendChild(opt);
    }
  }

  // ===== PHÂN TRANG =====
  $('#tp-prev').addEventListener('click', () => {
    if (stTP.page > 1) {
      stTP.page--;
      renderThuongPhatTable();
    }
  });

  $('#tp-next').addEventListener('click', () => {
    const totalPages = Math.ceil(stTP.total / stTP.limit);
    if (stTP.page < totalPages) {
      stTP.page++;
      renderThuongPhatTable();
    }
  });

  // ---- Sinh danh sách năm ----
  const namSelect = document.getElementById('tp-nam');
  if (namSelect) {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 1;
    const endYear = currentYear + 2;

    for (let y = startYear; y <= endYear; y++) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      namSelect.appendChild(opt);
    }

    namSelect.value = currentYear;
    st.filters.nam = currentYear;
  }
});

// ==== KHỞI CHẠY ====
document.addEventListener('DOMContentLoaded', async () => {
  if (!$('#thuong-phat-tab')) return;
  await fetchNhanVienList();
  await loadPhongBan();
  setupNhanVienTypeahead();
  setupFilters();

  $('#btn-tp-add').addEventListener('click', addTP);
  $('#tbody-tp').addEventListener('click', (e) => {
    const btn = e.target.closest("button[data-act='del']");
    if (btn) delTP(btn.dataset.id);
  });
  await fetchList();
});
