// phu-cap-thang.js (FULL FILE HOÀN CHỈNH – ĐÃ FIX NHIỀU LOẠI + Ô TIỀN RIÊNG)
import { api, requireAuthOrRedirect, getToken } from './api.js';

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
// ===== PHÂN TRANG PHỤ CẤP THÁNG =====
const stPage = {
  page: 1,
  limit: 10,
  total: 0,
  items: [],
};

let state = {
  items: [],
  loais: [],
  nhanViens: [],
  hopDongs: [],
  editingId: null,
  selectedLoaiIds: [],
};

// Lấy role từ người dùng đang đăng nhập
let CURRENT_USER = {};
try {
  CURRENT_USER = JSON.parse(localStorage.getItem('hr_user')) || {};
} catch (e) {
  CURRENT_USER = {};
}

const ROLE = (CURRENT_USER.role || '').toLowerCase();
const IS_MANAGER = ROLE === 'manager';
const IS_ADMIN = ROLE === 'admin';
const IS_EMPLOYEE = ROLE === 'employee';

// Backend trả snake_case: is_accounting_manager
const IS_ACCOUNTING_MANAGER =
  CURRENT_USER?.is_accounting_manager === true ||
  CURRENT_USER?.isAccountingManager === true;

// ======================================
// ẨN NÚT THÊM PHỤ CẤP THÁNG
// ======================================
document.addEventListener('DOMContentLoaded', () => {
  const btnAdd = document.querySelector('#btn-add-thang');

  if (!btnAdd) return;

  // 1️⃣ Employee → không được thêm
  if (IS_EMPLOYEE) {
    btnAdd.style.display = 'none';
  }

  // 2️⃣ Manager thường → vẫn được thêm nhưng KHÔNG sửa/xoá
  if (IS_MANAGER && !IS_ACCOUNTING_MANAGER) {
    btnAdd.style.display = 'inline-block';
  }

  // 3️⃣ Manager kế toán & Admin → full quyền → không ẩn gì
});

/* ===========================================================
   LOAD DATA
=========================================================== */
async function loadThang() {
  const qs = new URLSearchParams();

  const nv = $('#filter-nv').value;
  const thang = $('#filter-thang').value;
  const nam = $('#filter-nam').value;

  if (nv) qs.append('nhan_vien_id', nv);
  if (thang) qs.append('thang', thang);
  if (nam) qs.append('nam', nam);

  const res = await api(`/phu-cap-thang?${qs.toString()}`);
  state.items = res.data ?? [];

  stPage.page = 1; // ⭐ RESET PAGE KHI LỌC
  renderThang();
}

async function loadLoaiPC() {
  try {
    const res = await api('/phu-cap-loai?_=' + Date.now());

    if (Array.isArray(res)) state.loais = res;
    else if (Array.isArray(res.data)) state.loais = res.data;
    else if (Array.isArray(res.items)) state.loais = res.items;
    else state.loais = [];
  } catch (err) {
    console.error('❌ Lỗi load loại PC:', err);
    state.loais = [];
  }
}

// ===========================================================
//  LOAD DANH SÁCH NHÂN VIÊN
// ===========================================================
async function loadNhanVien() {
  const res = await api('/nhan-vien?limit=999&_=' + Date.now());
  let arr = res?.data?.items ?? [];

  // ===== PHÂN QUYỀN HIỂN THỊ =====
  if (ROLE === 'employee') {
    arr = arr.filter((nv) => nv.id === CURRENT_USER.employee_id);
  }

  if (IS_MANAGER && !IS_ACCOUNTING_MANAGER) {
    const managed = CURRENT_USER.managedDepartmentIds || [];
    if (managed.length > 0) {
      arr = arr.filter((nv) => managed.includes(nv.phong_ban_id));
    } else {
      arr = [];
    }
  }

  // Manager kế toán & Admin → không lọc

  state.nhanViens = arr;

  // Render bộ lọc NV ở toolbar
  $('#filter-nv').innerHTML =
    `<option value="">-- Nhân viên --</option>` +
    arr
      .map(
        (nv) => `<option value="${nv.id}">${nv.id} - ${esc(nv.ho_ten)}</option>`
      )
      .join('');
}

function setupNhanVienSearch() {
  const input = $('#nv-search-input');
  const dropdown = $('#nv-search-list');

  if (!input || !dropdown) return;

  input.addEventListener('input', () => {
    const keyword = input.value.toLowerCase().trim();
    if (!keyword) {
      dropdown.style.display = 'none';
      return;
    }

    const list = state.nhanViens.filter(
      (nv) =>
        nv.ho_ten.toLowerCase().includes(keyword) ||
        String(nv.id).includes(keyword)
    );

    if (list.length === 0) {
      dropdown.innerHTML = `<div class="nv-search-item text-muted">Không tìm thấy</div>`;
      dropdown.style.display = 'block';
      return;
    }

    dropdown.innerHTML = list
      .map(
        (nv) => `
        <div class="nv-search-item" data-id="${nv.id}">
          ${nv.id} - ${nv.ho_ten}
        </div>
      `
      )
      .join('');

    dropdown.style.display = 'block';
  });

  dropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.nv-search-item');
    if (!item) return;

    const id = item.dataset.id;
    input.value = `${id}`;
    input.dataset.selectedId = id;

    dropdown.style.display = 'none';
  });
}

/* ===========================================================
   RENDER TABLE
=========================================================== */
function renderThang() {
  const body = $('#thang-body');

  // ===== Lưu dữ liệu vào state phân trang =====
  stPage.items = state.items;
  stPage.total = state.items.length;

  if (!stPage.total) {
    body.innerHTML = `<tr><td colspan="7" class="text-muted">Không có dữ liệu</td></tr>`;
    return;
  }

  const start = (stPage.page - 1) * stPage.limit;
  const end = start + stPage.limit;
  const rows = stPage.items.slice(start, end);

  body.innerHTML = rows
    .map(
      (x) => `
      <tr class="${x.is_fixed ? 'pc-fixed-row' : ''}">
        <td>${esc(x.id)}</td>
        <td>${esc(x.ho_ten || '')}</td>
        <td>${x.is_fixed ? 'Cố định' : `${x.thang}/${x.nam}`}</td>
        <td>${esc(x.ten_phu_cap)}</td>
        <td>${Number(x.so_tien).toLocaleString('vi-VN')}</td>
        <td>${esc(x.ghi_chu || '')}</td>
        <td>
          ${
            IS_EMPLOYEE
              ? `` // Nhân viên không có nút gì
              : IS_MANAGER && !IS_ACCOUNTING_MANAGER
              ? `` // Manager thường: CHỈ được thêm, KHÔNG sửa/xóa
              : `
                <button class="btn btn-sm btn-edit" data-id="${x.id}">✏️</button>
                <button class="btn btn-sm btn-del" data-id="${x.id}">🗑️</button>
              `
          }
        </td>
      </tr>
      `
    )
    .join('');

  // ===== Cập nhật phân trang =====
  const totalPages = Math.max(1, Math.ceil(stPage.total / stPage.limit));
  $('#pc-pageInfo').textContent = `Trang ${stPage.page}/${totalPages}`;
  $('#pc-prev').disabled = stPage.page <= 1;
  $('#pc-next').disabled = stPage.page >= totalPages;
}

/* ===========================================================
   RENDER Ô TIỀN + GHI CHÚ THEO TỪNG LOẠI
=========================================================== */
function renderMoneyInputs() {
  const container = $('#money-container');
  if (!container) return;

  container.innerHTML = '';

  const selectedOptions = Array.from($('#thang-loai').selectedOptions);

  selectedOptions.forEach((opt) => {
    const loaiId = Number(opt.value);
    const ten = opt.textContent;

    const div = document.createElement('div');
    div.className = 'money-row';
    div.style =
      'display:flex; gap:10px; margin-bottom:8px; align-items:center;';

    div.innerHTML = `
      <label style="min-width:180px">${ten}</label>

      <input 
        type="number"
        class="money-input"
        data-id="${loaiId}"
        min="0"
        step="10000"
        placeholder="Số tiền cho ${ten}"
        style="flex:1"
      />

      <input 
        type="text"
        class="note-input"
        data-id="${loaiId}"
        placeholder="Ghi chú (${ten})"
        style="flex:1"
      />
    `;

    container.appendChild(div);
  });
}

/* ===========================================================
   KHÔNG DISABLE THÁNG/NĂM NỮA
=========================================================== */
function handleLoaiChange(loaiIds) {
  // UI mới: tháng/năm luôn nhập được
  renderMoneyInputs();
}

/* ===========================================================
   MỞ MODAL (THÊM / SỬA)
=========================================================== */
async function openThangModal(item = null) {
  await loadLoaiPC();
  await loadNhanVien();

  state.editingId = item?.id ?? null;

  $('#thang-title').textContent = item ? 'Sửa phụ cấp' : 'Thêm phụ cấp tháng';
  $('#thang-id').value = item?.id ?? '';
  $('#thang-note').value = item?.ghi_chu ?? '';

  // Reset tháng/năm
  $('#thang-thang').value = '';
  $('#thang-nam').value = '';

  $('#money-container').innerHTML = '';

  const selectLoai = $('#thang-loai');
  const smallNote = selectLoai.nextElementSibling;

  // Render loại phụ cấp
  selectLoai.innerHTML = state.loais
    .map(
      (x) => `
        <option value="${x.id}" data-fixed="${x.is_fixed}">
          ${esc(x.ten)} ${x.is_fixed ? '(Cố định)' : '(Theo tháng)'}
        </option>
      `
    )
    .join('');

  // Manager thường không được chọn loại cố định
  if (IS_MANAGER && !IS_ACCOUNTING_MANAGER) {
    Array.from(selectLoai.options).forEach((opt) => {
      if (opt.dataset.fixed == '1') opt.disabled = true;
    });
  }

  const nvInput = $('#nv-search-input');

  /* ==========================
      CHẾ ĐỘ SỬA
  ========================== */
  if (item) {
    // Gán NV vào ô tìm kiếm
    nvInput.value = `${item.nhan_vien_id} - ${item.ho_ten}`;
    nvInput.dataset.selectedId = item.nhan_vien_id;

    // Khóa không cho đổi nhân viên
    nvInput.classList.add('locked-select');
    nvInput.readOnly = true;

    // Loại phụ cấp
    selectLoai.removeAttribute('multiple');
    selectLoai.disabled = true;
    smallNote.hidden = true;

    selectLoai.value = String(item.loai_id);

    const loai = state.loais.find((l) => l.id == item.loai_id);

    if (!loai?.is_fixed) {
      $('#thang-thang').value = item.thang;
      $('#thang-nam').value = item.nam;
    }

    $('#thang-thang').disabled = true;
    $('#thang-nam').disabled = true;

    state.selectedLoaiIds = [item.loai_id];
    renderMoneyInputs();

    $(`.money-input[data-id="${item.loai_id}"]`).value = item.so_tien;
    $(`.note-input[data-id="${item.loai_id}"]`).value = item.ghi_chu ?? '';
  } else {
    /* ==========================
        CHẾ ĐỘ THÊM
    ========================== */

    nvInput.value = '';
    nvInput.dataset.selectedId = '';
    nvInput.readOnly = false;
    nvInput.classList.remove('locked-select');

    $('#thang-thang').disabled = false;
    $('#thang-nam').disabled = false;

    selectLoai.setAttribute('multiple', 'multiple');
    selectLoai.disabled = false;
    smallNote.hidden = false;

    Array.from(selectLoai.options).forEach((opt) => (opt.selected = false));
  }

  $('#thang-error').hidden = true;
  $('#modal-thang').showModal();
}

function closeThangModal() {
  $('#modal-thang').close();
  state.selectedLoaiIds = [];

  // Vì đã chuyển từ <select> sang search input → không còn thang-nv
  const nvSelect = $('#thang-nv');
  if (nvSelect) {
    nvSelect.classList.remove('locked-select');
  }

  $('#nv-search-input').value = '';
  $('#nv-search-input').dataset.selectedId = '';

  $('#thang-loai').disabled = false;
  $('#thang-thang').disabled = false;
  $('#thang-nam').disabled = false;
}

/* ===========================================================
   LƯU PHỤ CẤP
=========================================================== */
async function saveThang(e) {
  e.preventDefault();
  $('#thang-error').hidden = true;

  const nvInput = $('#nv-search-input');
  const nvId = Number(nvInput.dataset.selectedId || 0);

  const thang = Number($('#thang-thang').value);
  const nam = Number($('#thang-nam').value);
  const ghiChuChung = $('#thang-note').value.trim();

  const select = $('#thang-loai');
  const selectedOptions = Array.from(select.selectedOptions);
  const selectedIds = selectedOptions.map((opt) => Number(opt.value));

  if (!nvId) {
    $('#thang-error').textContent = 'Chưa chọn nhân viên!';
    $('#thang-error').hidden = false;
    return;
  }

  if (selectedIds.length === 0) {
    $('#thang-error').textContent = 'Chưa chọn loại phụ cấp!';
    $('#thang-error').hidden = false;
    return;
  }

  for (const loaiId of selectedIds) {
    const loai = state.loais.find((l) => l.id == loaiId);
    if (!loai) {
      $('#thang-error').textContent = 'Loại phụ cấp không hợp lệ!';
      $('#thang-error').hidden = false;
      return;
    }
    if (loai.is_fixed === 0 && (!thang || !nam)) {
      $('#thang-error').textContent = 'Phụ cấp theo tháng cần tháng & năm!';
      $('#thang-error').hidden = false;
      return;
    }
  }

  try {
    /* ---------------------------------------------------------
        CHẾ ĐỘ SỬA
    --------------------------------------------------------- */
    if (state.editingId) {
      const loaiId = selectedIds[0];
      const loai = state.loais.find((l) => l.id == loaiId);

      const moneyInp = document.querySelector(
        `.money-input[data-id="${loaiId}"]`
      );
      const noteInp = document.querySelector(
        `.note-input[data-id="${loaiId}"]`
      );

      const so_tien = moneyInp ? Number(moneyInp.value) || 0 : 0;
      const ghi_chu = noteInp ? noteInp.value.trim() : ghiChuChung;

      const payload = {
        nhan_vien_id: nvId,
        loai_id: loaiId,
        hop_dong_id: 0,
        thang: loai?.is_fixed ? null : thang,
        nam: loai?.is_fixed ? null : nam,
        so_tien,
        ghi_chu,
      };

      await api(`/phu-cap-thang/${state.editingId}`, {
        method: 'PUT',
        body: payload,
      });
    } else {
      /* ---------------------------------------------------------
        CHẾ ĐỘ THÊM NHIỀU LOẠI
    --------------------------------------------------------- */
      const so_tien_map = {};
      const ghi_chu_map = {};

      document.querySelectorAll('.money-input').forEach((inp) => {
        const id = inp.dataset.id;
        so_tien_map[id] = Number(inp.value) || 0;
      });

      document.querySelectorAll('.note-input').forEach((inp) => {
        const id = inp.dataset.id;
        ghi_chu_map[id] = inp.value.trim() || ghiChuChung;
      });

      const payload = {
        nhan_vien_id: nvId,
        loai_ids: selectedIds,
        hop_dong_id: 0,
        thang: thang || null,
        nam: nam || null,
        so_tien_map,
        ghi_chu_map,
      };

      await api('/phu-cap-thang', { method: 'POST', body: payload });
    }

    closeThangModal();
    await loadThang();
  } catch (err) {
    $('#thang-error').textContent = err?.message || 'Lỗi lưu!';
    $('#thang-error').hidden = false;
  }
}

/* ===========================================================
   AUTO COPY
=========================================================== */
async function autoCopyLastMonth() {
  const thang = Number($('#filter-thang').value);
  const nam = Number($('#filter-nam').value);

  if (!thang || !nam) {
    alert('Vui lòng chọn tháng và năm!');
    return;
  }

  const thangTruoc = thang === 1 ? 12 : thang - 1;
  const namTruoc = thang === 1 ? nam - 1 : nam;

  if (
    !confirm(
      `Copy phụ cấp từ tháng ${thangTruoc}/${namTruoc} sang tháng ${thang}/${nam}?\n\n⚠️ Chỉ copy phụ cấp theo tháng.`
    )
  ) {
    return;
  }

  try {
    const res = await api('/phu-cap-thang/auto-copy', {
      method: 'POST',
      body: { thang, nam },
    });

    // Copy OK
    if (res.ok) {
      alert(
        `✔ Copy thành công ${res.copiedCount} phụ cấp từ ${res.from} → ${res.to}`
      );

      await loadThang();
      return;
    }

    // Lỗi hợp lệ
    alert(`⚠ ${res.error || 'Không thể copy!'}`);
  } catch (err) {
    alert('❌ Lỗi hệ thống!');
  }
}

/* ===========================================================
   XÓA
=========================================================== */
async function deleteThang(id) {
  if (IS_MANAGER && !IS_ACCOUNTING_MANAGER) {
    const item = state.items.find((x) => x.id == id);
    if (item?.is_fixed == 1) {
      alert('Bạn không có quyền xóa phụ cấp cố định!');
      return;
    }
  }
  if (!confirm(`Xóa phụ cấp #${id}?`)) return;
  await api(`/phu-cap-thang/${id}`, { method: 'DELETE' });
  await loadThang();
}

function setDefaultFilter() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const filterThang = $('#filter-thang');
  const filterNam = $('#filter-nam');

  if (filterThang && !filterThang.value) filterThang.value = month;
  if (filterNam && !filterNam.value) filterNam.value = year;
}

/* ===========================================================
   BIND EVENTS
=========================================================== */
function bindThangEvents() {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // JS: 0 → Jan, 11 → Dec
  const currentYear = now.getFullYear();

  // Nếu người dùng chưa chọn → set mặc định
  if (!$('#filter-thang').value) $('#filter-thang').value = currentMonth;
  if (!$('#filter-nam').value) $('#filter-nam').value = currentYear;

  $('#button-filter').addEventListener('click', loadThang);

  // ⭐ Nút hiển thị tất cả (cố định + theo tháng)
  $('#btn-show-all').addEventListener('click', async () => {
    const qs = new URLSearchParams();

    const nv = $('#filter-nv').value;
    const thang = $('#filter-thang').value;
    const nam = $('#filter-nam').value;

    if (nv) qs.append('nhan_vien_id', nv);
    if (thang) qs.append('thang', thang);
    if (nam) qs.append('nam', nam);

    qs.append('mode', 'all'); // ⭐ Quan trọng — báo backend lấy cả cố định

    const res = await api(`/phu-cap-thang?${qs.toString()}`);
    state.items = res.data ?? [];
    renderThang();
    /* ===========================================================
    PHÂN QUYỀN FRONTEND — ẨN NÚT / CHỨC NĂNG
=========================================================== */

    // 1️⃣ Employee → KHÔNG được thêm, KHÔNG sửa, KHÔNG xoá
    if (IS_EMPLOYEE) {
      const btnAdd = $('#btn-add-thang');
      if (btnAdd) btnAdd.style.display = 'none';
    }

    // 2️⃣ Manager thường → chỉ được thêm, KHÔNG sửa, KHÔNG xoá
    if (IS_MANAGER && !IS_ACCOUNTING_MANAGER) {
      const btnAdd = $('#btn-add-thang');
      if (btnAdd) btnAdd.style.display = 'inline-block'; // vẫn được thêm

      // Sửa/xoá xử lý tại render table, không xử lý thêm tại đây
    }

    // 3️⃣ Manager kế toán & Admin → full quyền → không ẩn gì
    // (Không cần code thêm)
  });

  const thangTab = document.getElementById('thang-tab');
  const toolbar = thangTab?.querySelector('.toolbar');

  if (toolbar && !document.getElementById('btn-auto-copy')) {
    const btnAutoCopy = document.createElement('button');
    btnAutoCopy.id = 'btn-auto-copy';
    btnAutoCopy.type = 'button';
    btnAutoCopy.className = 'btn btn-warn';
    btnAutoCopy.textContent = '📋 Copy từ tháng trước';
    btnAutoCopy.addEventListener('click', autoCopyLastMonth);

    toolbar.insertBefore(btnAutoCopy, toolbar.querySelector('#btn-add-thang'));
  }

  // ===== PHÂN TRANG =====
  $('#pc-prev').addEventListener('click', () => {
    if (stPage.page > 1) {
      stPage.page--;
      renderThang();
    }
  });

  $('#pc-next').addEventListener('click', () => {
    const totalPages = Math.ceil(stPage.total / stPage.limit);
    if (stPage.page < totalPages) {
      stPage.page++;
      renderThang();
    }
  });

  // =====================================================
  $('#btn-add-thang').addEventListener('click', () => openThangModal());

  $('#btn-cancel-thang').addEventListener('click', closeThangModal);
  $('#form-thang').addEventListener('submit', saveThang);

  $('#thang-body').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const id = btn.dataset.id;
    const item = state.items.find((x) => x.id == id);

    if (btn.classList.contains('btn-edit')) {
      if (IS_EMPLOYEE) {
        alert('Bạn không có quyền sửa phụ cấp!');
        return;
      }
      if (IS_MANAGER && !IS_ACCOUNTING_MANAGER) {
        alert('Manager thường không được sửa phụ cấp!');
        return;
      }
      openThangModal(item);
    }

    if (btn.classList.contains('btn-del')) deleteThang(id);
  });

  // ⭐ Khi chọn loại → cập nhật ô nhập tiền
  $('#thang-loai').addEventListener('change', (e) => {
    const selectedOptions = Array.from(e.target.selectedOptions);
    const loaiIds = selectedOptions.map((opt) => Number(opt.value));

    handleLoaiChange(loaiIds);
  });
}

/* ===========================================================
   INIT
=========================================================== */
async function init() {
  requireAuthOrRedirect('./dang-nhap.html');
  if (!getToken()) return;

  await loadLoaiPC();
  await loadNhanVien();
  setupNhanVienSearch();

  setDefaultFilter();
  await loadThang();

  bindThangEvents();
}

document.addEventListener('DOMContentLoaded', init);
