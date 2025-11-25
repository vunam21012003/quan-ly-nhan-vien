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
const IS_ACCOUNTING_MANAGER = CURRENT_USER?.is_accounting_manager === true;

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
  // thêm _=... để tránh cache
  const res = await api('/nhan-vien?limit=999&_=' + Date.now());
  const arr = res?.data?.items ?? [];
  state.nhanViens = arr;

  // Filter NV trên toolbar
  $('#filter-nv').innerHTML =
    `<option value="">-- Nhân viên --</option>` +
    arr
      .map(
        (nv) => `<option value="${nv.id}">${nv.id} - ${esc(nv.ho_ten)}</option>`
      )
      .join('');

  // Dropdown nhân viên trong modal
  $('#thang-nv').innerHTML = arr
    .map(
      (nv) => `<option value="${nv.id}">${nv.id} - ${esc(nv.ho_ten)}</option>`
    )
    .join('');
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
            // Manager thường KHÔNG được sửa/xóa phụ cấp cố định
            IS_MANAGER && !IS_ACCOUNTING_MANAGER && x.is_fixed == 1
              ? ``
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
  // luôn đảm bảo đã có loại PC + nhân viên
  await loadLoaiPC();
  await loadNhanVien();

  state.editingId = item?.id ?? null;
  state.selectedLoaiIds = [];

  $('#thang-title').textContent = item ? 'Sửa phụ cấp' : 'Thêm phụ cấp tháng';
  $('#thang-id').value = item?.id ?? '';
  $('#thang-note').value = item?.ghi_chu ?? '';

  // reset tháng / năm
  $('#thang-thang').value = '';
  $('#thang-nam').value = '';

  // reset các dòng tiền
  $('#money-container').innerHTML = '';

  const nvSelect = $('#thang-nv');
  const selectLoai = $('#thang-loai');
  const smallNote = selectLoai.nextElementSibling;

  // render danh sách loại phụ cấp
  selectLoai.innerHTML = state.loais
    .map(
      (x) => `<option value="${x.id}" data-fixed="${x.is_fixed}">
        ${esc(x.ten)} ${x.is_fixed ? '(Cố định)' : '(Theo tháng)'}
      </option>`
    )
    .join('');

  if (IS_MANAGER && !IS_ACCOUNTING_MANAGER) {
    // Không cho chọn loại cố định
    Array.from(selectLoai.options).forEach((opt) => {
      if (opt.dataset.fixed == '1') opt.disabled = true;
    });
  }

  /* ============================
        CHẾ ĐỘ SỬA
  ============================ */
  if (item) {
    // ---- Nhân viên: hiển thị đúng & khóa cứng (KHÔNG disabled)
    nvSelect.value = item.nhan_vien_id;
    nvSelect.classList.add('locked-select');
    // KHÔNG disabled, KHÔNG pointer-events: none
    // khóa nhưng không disable

    // ---- Loại phụ cấp: chỉ 1 loại, khóa cứng
    selectLoai.removeAttribute('multiple');
    selectLoai.value = String(item.loai_id);
    selectLoai.disabled = true;
    smallNote.hidden = true;

    const loai = state.loais.find((l) => l.id == item.loai_id);

    // Phụ cấp theo tháng → giữ nguyên tháng/năm, nhưng khóa ô
    if (!loai?.is_fixed) {
      $('#thang-thang').value = item.thang ?? '';
      $('#thang-nam').value = item.nam ?? '';
    }

    if (item && IS_MANAGER && !IS_ACCOUNTING_MANAGER && item.is_fixed == 1) {
      alert('Bạn không có quyền sửa phụ cấp cố định!');
      return;
    }

    // Khóa tháng + năm
    $('#thang-thang').disabled = true;
    $('#thang-nam').disabled = true;

    // render 1 hàng tiền / ghi chú cho loại này
    state.selectedLoaiIds = [item.loai_id];
    renderMoneyInputs();

    const moneyInput = document.querySelector(
      `.money-input[data-id="${item.loai_id}"]`
    );
    if (moneyInput) moneyInput.value = item.so_tien;

    const noteInput = document.querySelector(
      `.note-input[data-id="${item.loai_id}"]`
    );
    if (noteInput) noteInput.value = item.ghi_chu ?? '';
  } else {
    /* ============================
        CHẾ ĐỘ THÊM
  ============================ */
    // không khóa nhân viên
    nvSelect.value = '';
    nvSelect.classList.remove('locked-select');

    // mở tháng / năm
    $('#thang-thang').disabled = false;
    $('#thang-nam').disabled = false;

    // mở loại phụ cấp
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

  // mở lại cho lần thêm mới sau
  const nvSelect = $('#thang-nv');
  nvSelect.classList.remove('locked-select');

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

  const nvId = Number($('#thang-nv').value);
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

    if (btn.classList.contains('btn-edit')) openThangModal(item);
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

  setDefaultFilter();
  await loadThang();

  bindThangEvents();
}

document.addEventListener('DOMContentLoaded', init);
