//chan-cong.js
import { api, getUser, getToken, requireAuthOrRedirect } from './api.js';

// --- STATE ---
const st = {
  page: 1,
  limit: 10,
  total: 0,
  items: [],
  currentParams: {},
};

let cachedEmployees = [];

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
const fmtDate = (s) => (s ? ('' + s).slice(0, 10) : '');
const fmtTime = (s) => (s ? ('' + s).slice(0, 8) : '');

function unwrap(r) {
  const d = r?.data ?? r;
  if (Array.isArray(d)) return { items: d, total: d.length };
  return { items: d?.items || d?.rows || d?.list || [], total: d?.total || 0 };
}

function getStatusBadge(status) {
  const s = (status || '').toLowerCase();
  const map = {
    di_lam: ['cc-badge-ok', 'Đi làm'],
    di_muon: ['cc-badge-warn', 'Đi muộn'],
    ve_som: ['cc-badge-warn', 'Về sớm'],
    nghi_phep: ['cc-badge-gray', 'Nghỉ phép'],
    nghi_khong_phep: ['cc-badge-err', 'Không phép'],
    ngay_le: ['cc-badge-info', 'Ngày lễ'],
  };
  if (s.includes('muon') && s.includes('som'))
    return '<span class="cc-badge cc-badge-warn">Muộn + Sớm</span>';
  const conf = map[s];
  return conf
    ? `<span class="cc-badge ${conf[0]}">${conf[1]}</span>`
    : `<span class="cc-badge cc-badge-gray">${esc(status)}</span>`;
}

async function loadData() {
  const cleanParams = { page: String(st.page), limit: String(st.limit) };
  for (const [key, value] of Object.entries(st.currentParams)) {
    if (
      value !== null &&
      value !== undefined &&
      value !== '' &&
      value !== 'null'
    ) {
      cleanParams[key] = value;
    }
  }
  const qs = new URLSearchParams(cleanParams);
  $(
    '#tbody'
  ).innerHTML = `<tr><td colspan="9" class="text-muted" style="text-align:center;">Đang tải dữ liệu...</td></tr>`;

  try {
    const resp = await api(`/cham-cong?${qs}`);
    const { items, total } = unwrap(resp);
    st.items = items;
    st.total = total || items.length;
    $('#tbody').innerHTML = items.length
      ? items.map(rowHtml).join('')
      : `<tr><td colspan="9" class="text-muted" style="text-align:center;">Không có dữ liệu phù hợp</td></tr>`;
    renderPagination();
  } catch (e) {
    $(
      '#tbody'
    ).innerHTML = `<tr><td colspan="9" class="text-error">Lỗi tải dữ liệu: ${e.message}</td></tr>`;
  }
}

function renderPagination() {
  const totalPages = Math.max(1, Math.ceil(st.total / st.limit));
  $('#pageInfo').textContent = `Trang ${st.page}/${totalPages}`;
  $('#prev').disabled = st.page <= 1;
  $('#next').disabled = st.page >= totalPages;
}

function rowHtml(x) {
  const u = getUser();
  const isEmployee = u?.role === 'employee';
  const nv = x.ho_ten ? `<b>${esc(x.ho_ten)}</b>` : `ID: ${x.nhan_vien_id}`;
  const btns = isEmployee
    ? ''
    : `
      <button class="cc-btn-action" data-act="edit" data-id="${x.id}" title="Sửa"><i class="fa-solid fa-pen" style="color:#f6c23e"></i>
</button>
      <button class="cc-btn-action del" data-act="del" data-id="${x.id}" title="Xóa"><i class="fa-solid fa-trash" style="color:#e74a3b"></i>
</button>
    `;

  // Map loai_ngay to readable text
  const loaiMap = {
    thuong: 'Thường',
    le: 'Lễ',
    tet: 'Tết',
    lam_bu: 'Làm bù',
  };
  const loaiText = loaiMap[x.loai_ngay] || x.loai_ngay || '-';

  return `<tr>
    <td>${esc(x.nhan_vien_id)}</td>
    <td>${nv}</td>
    <td>${esc(fmtDate(x.ngay_lam))}</td>
    <td>${esc(fmtTime(x.gio_vao) || '-')}</td>
    <td>${esc(fmtTime(x.gio_ra) || '-')}</td>
    <td>${getStatusBadge(x.trang_thai)}</td>
    <td>${esc(loaiText)}</td>
    <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(
      x.ghi_chu
    )}">${esc(x.ghi_chu || '')}</td>
    <td>${btns}</td>
  </tr>`;
}

// --- 1.2 Autocomplete Logic ---
async function fetchAllEmployees() {
  try {
    const res = await api('/nhan-vien?limit=2000');
    const { items } = unwrap(res);
    cachedEmployees = items.map((e) => ({
      id: e.id,
      name: e.ho_ten,
      searchStr: `${e.ho_ten} ${e.id} ${removeVietnameseTones(
        e.ho_ten
      )}`.toLowerCase(),
    }));
  } catch (e) {
    console.error('Lỗi tải DS nhân viên:', e);
  }
}

function removeVietnameseTones(str) {
  if (!str) return '';
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
  str = str.replace(/đ/g, 'd');
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, 'A');
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, 'E');
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, 'I');
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, 'O');
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, 'U');
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, 'Y');
  str = str.replace(/Đ/g, 'D');
  return str;
}

function bindIdInput(inpId, inpName) {
  inpId.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    if (!val) return;
    const found = cachedEmployees.find((x) => x.id === val);
    if (found) {
      inpName.value = found.name;
      inpId.parentElement.style.borderBottom = 'none';
    } else {
      inpName.value = '';
    }
  });
}

function bindNameInput(inpName, inpId) {
  let dd = document.getElementById('global-ac-dropdown');
  if (!dd) {
    dd = document.createElement('div');
    dd.id = 'global-ac-dropdown';
    dd.className = 'ac-dropdown';
    document.body.appendChild(dd);
  }

  let activeInput = null;

  const hide = () => {
    dd.style.display = 'none';
    activeInput = null;
  };

  const show = (keyword) => {
    const dialog = inpName.closest('dialog');

    if (dialog) {
      if (dd.parentElement !== dialog) {
        dialog.appendChild(dd);
      }
    } else {
      if (dd.parentElement !== document.body) {
        document.body.appendChild(dd);
      }
    }

    const rect = inpName.getBoundingClientRect();
    dd.style.top = rect.bottom + 2 + 'px';
    dd.style.left = rect.left + 'px';
    dd.style.width = rect.width + 'px';
    dd.style.display = 'block';
    activeInput = inpName;

    const kw = keyword.toLowerCase();
    const matches = cachedEmployees
      .filter((e) => e.searchStr.includes(kw))
      .slice(0, 15);

    if (matches.length === 0) {
      dd.innerHTML = `<div class="ac-item" style="cursor:default; color:#999;">Không tìm thấy...</div>`;
      return;
    }

    dd.innerHTML = matches
      .map(
        (e) => `
      <div class="ac-item" data-id="${e.id}" data-name="${e.name}">
        <strong>${e.name}</strong> <span>ID: ${e.id}</span>
      </div>
    `
      )
      .join('');
  };

  inpName.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (val.length > 0) show(removeVietnameseTones(val));
    else hide();
  });

  inpName.addEventListener('focus', () => {
    const val = inpName.value.trim();

    if (!val) {
      show('');
      dd.innerHTML = cachedEmployees
        .slice(0, 5)
        .map(
          (e) =>
            `<div class="ac-item" data-id="${e.id}" data-name="${e.name}"><strong>${e.name}</strong> <span>ID: ${e.id}</span></div>`
        )
        .join('');
    } else {
      show(removeVietnameseTones(val));
    }
  });

  dd.onmousedown = (e) => {
    if (activeInput !== inpName) return;
    const item = e.target.closest('.ac-item');
    if (item && !item.innerText.includes('Không tìm thấy')) {
      inpId.value = item.dataset.id;
      inpName.value = item.dataset.name;
      hide();
    }
  };

  window.addEventListener('scroll', hide, true);
  window.addEventListener('resize', hide);
  document.addEventListener('click', (e) => {
    if (e.target !== inpName && !dd.contains(e.target)) hide();
  });
}

// --- 1.3 Batch Entry ---
function createRowHTML(data = {}) {
  const tr = document.createElement('tr');
  tr.className = 'batch-row';
  if (data.id) tr.dataset.editId = data.id;

  const today = new Date().toISOString().slice(0, 10);
  const nvId = data.nhan_vien_id || '';
  const nvName =
    data.ho_ten ||
    (nvId ? cachedEmployees.find((e) => e.id == nvId)?.name : '') ||
    '';

  tr.innerHTML = `
    <td><input type="number" class="inp-id" value="${nvId}" placeholder="ID" required></td>
    <td>
      <input type="text" class="inp-name" value="${esc(
        nvName
      )}" placeholder="Nhập tên..." autocomplete="off">
    </td>
    <td><input type="date" class="inp-date" value="${
      data.ngay_lam ? fmtDate(data.ngay_lam) : today
    }" required></td>
    <td><input type="time" class="inp-in" value="${fmtTime(data.gio_vao)}"></td>
    <td><input type="time" class="inp-out" value="${fmtTime(data.gio_ra)}"></td>
    <td>
      <select class="inp-status">
        <option value="di_lam">Đi làm</option>
        <option value="di_muon">Đi muộn</option>
        <option value="ve_som">Về sớm</option>
        <option value="nghi_phep">Nghỉ phép</option>
        <option value="nghi_khong_phep">Nghỉ không phép</option>
      </select>
    </td>
    <td>
      <select class="inp-loai-ngay">
        <option value="thuong">Thường</option>
        <option value="le">Lễ</option>
        <option value="tet">Tết</option>
        <option value="lam_bu">Làm bù</option>
      </select>
    </td>
    <td><input type="text" class="inp-note" value="${esc(
      data.ghi_chu || ''
    )}" placeholder="..."></td>
    <td><button type="button" class="btn-remove-row">x</button></td>
  `;

  if (data.trang_thai) tr.querySelector('.inp-status').value = data.trang_thai;
  if (data.loai_ngay) tr.querySelector('.inp-loai-ngay').value = data.loai_ngay;

  bindIdInput(tr.querySelector('.inp-id'), tr.querySelector('.inp-name'));
  bindNameInput(tr.querySelector('.inp-name'), tr.querySelector('.inp-id'));
  tr.querySelector('.btn-remove-row').addEventListener('click', () =>
    tr.remove()
  );

  return tr;
}

function openBatchModal(editRow = null) {
  const tbody = $('#batch-tbody');
  tbody.innerHTML = '';
  $('#modal-error').hidden = true;

  if (editRow) {
    tbody.appendChild(createRowHTML(editRow));
    $('#btn-add-row').style.display = 'none';
  } else {
    tbody.appendChild(createRowHTML());
    $('#btn-add-row').style.display = 'inline-block';
  }
  $('#modal').showModal();
}

async function saveBatch(e) {
  e.preventDefault();
  const rows = document.querySelectorAll('.batch-row');
  if (rows.length === 0) return;

  const payloadList = [];
  let hasError = false;

  rows.forEach((tr) => {
    const nvId = tr.querySelector('.inp-id').value;
    const date = tr.querySelector('.inp-date').value;

    if (!nvId || !date) {
      tr.style.backgroundColor = '#fee2e2';
      hasError = true;
    } else {
      tr.style.backgroundColor = '#fff';
    }

    payloadList.push({
      editId: tr.dataset.editId || null,
      data: {
        nhan_vien_id: Number(nvId),
        ngay_lam: date,
        gio_vao: tr.querySelector('.inp-in').value || null,
        gio_ra: tr.querySelector('.inp-out').value || null,
        trang_thai: tr.querySelector('.inp-status').value,
        loai_ngay: tr.querySelector('.inp-loai-ngay').value,
        ghi_chu: tr.querySelector('.inp-note').value.trim() || null,
      },
    });
  });

  if (hasError) {
    $('#modal-error').textContent =
      'Vui lòng điền ID và Ngày cho các dòng màu đỏ.';
    $('#modal-error').hidden = false;
    return;
  }

  try {
    const promises = payloadList.map((item) => {
      if (item.editId)
        return api(`/cham-cong/${item.editId}`, {
          method: 'PUT',
          body: item.data,
        });
      return api('/cham-cong', { method: 'POST', body: item.data });
    });

    await Promise.all(promises);
    $('#modal').close();
    loadData();
    alert(`✅ Đã lưu thành công ${payloadList.length} bản ghi.`);
  } catch (err) {
    $('#modal-error').textContent = 'Lỗi: ' + err.message;
    $('#modal-error').hidden = false;
  }
}

async function fetchPhongBan() {
  try {
    const resp = await api('/cham-cong/phong-ban/list');
    const { items } = unwrap(resp);
    const select = $('#phongBanFilter');
    select.innerHTML =
      '<option value="">-- Tất cả phòng ban --</option>' +
      items
        .map((x) => `<option value="${x.id}">${esc(x.ten_phong_ban)}</option>`)
        .join('');
  } catch (e) {
    console.error(e);
  }
}

async function onUploadExcel(e) {
  const file = e.target.files[0];
  if (!file) return alert('Vui lòng chọn file Excel!');

  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/cham-cong/import-excel', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!res.ok) {
      const msg = await res.text();
      alert('Upload thất bại: ' + msg);
    } else {
      const result = await res.json();
      alert(result.message || 'Upload thành công!');
      loadData();
    }
  } catch (err) {
    alert('Lỗi kết nối');
  }
  e.target.value = '';
}

async function init() {
  requireAuthOrRedirect('./dang-nhap.html');
  if (!getToken()) return;

  const u = getUser();
  if (u && (u.role === 'manager' || u.role === 'employee')) {
    if (u.role === 'employee') {
      if ($('#btn-create')) $('#btn-create').style.display = 'none';
    }
  }

  if (u && u.role === 'admin') {
    const btnAuto = $('#btn-auto-process');
    if (btnAuto) btnAuto.style.display = 'inline-block';
  }

  await fetchAllEmployees();
  await fetchPhongBan();

  const today = new Date().toISOString().slice(0, 10);
  $('#from').value = today;
  $('#to').value = today;
  st.currentParams = { from: today, to: today };
  await loadData();

  bindEvents();
}

function bindEvents() {
  $('#btn-search').addEventListener('click', () => {
    st.currentParams = {
      nhan_vien_id: $('#nvId').value.trim() || '',
      ten_nhan_vien: $('#nvName').value.trim() || '',
      trang_thai: $('#statusFilter').value || '',
      phong_ban_id: $('#phongBanFilter').value || '',
      from: $('#from').value || '',
      to: $('#to').value || '',
    };
    st.page = 1;
    loadData();
  });

  $('#prev').addEventListener('click', () => {
    if (st.page > 1) {
      st.page--;
      loadData();
    }
  });
  $('#next').addEventListener('click', () => {
    const max = Math.ceil(st.total / st.limit);
    if (st.page < max) {
      st.page++;
      loadData();
    }
  });

  //admin nhan tu dong cham cong
  const btnAuto = $('#btn-auto-process');
  if (btnAuto) {
    btnAuto.addEventListener('click', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const dateInput = prompt(
        'Nhập ngày cần chấm công tự động (YYYY-MM-DD):',
        today
      );

      if (!dateInput) return;

      if (
        !confirm(
          `Bạn có chắc muốn chạy chấm công tự động cho ngày ${dateInput}? \nDữ liệu cũ chưa có sẽ được điền tự động.`
        )
      ) {
        return;
      }

      // 3. Gọi API
      try {
        btnAuto.disabled = true;
        btnAuto.textContent = 'Đang xử lý...';

        const res = await api(`/cham-cong/auto-process?date=${dateInput}`, {
          method: 'POST',
        });

        // 4. Thông báo kết quả
        const result = res.data || res;
        alert(
          `Xử lý xong!\n- Đã thêm: ${
            result.processedCount
          }\n- Bỏ qua (đã có/đã duyệt lương): ${result.skippedCount}\n${
            result.errors ? '- Lỗi: ' + result.errors.length : ''
          }`
        );

        // 5. Tải lại bảng dữ liệu
        loadData();
      } catch (err) {
        alert(' Lỗi: ' + (err.message || 'Không thể xử lý'));
      } finally {
        btnAuto.disabled = false;
        btnAuto.innerHTML = '<i class="fa fa-magic"></i> Chạy tự động';
      }
    });
  }

  $('#btn-refresh').addEventListener('click', () => {
    const t = new Date().toISOString().slice(0, 10);
    $('#from').value = t;
    $('#to').value = t;
    $('#nvId').value = '';
    $('#nvName').value = '';
    $('#statusFilter').value = '';
    st.currentParams = { from: t, to: t };
    st.page = 1;
    loadData();
  });

  $('#btn-create').addEventListener('click', () => openBatchModal(null));
  $('#btn-add-row').addEventListener('click', () =>
    $('#batch-tbody').appendChild(createRowHTML())
  );
  $('#form').addEventListener('submit', saveBatch);
  $('#btn-cancel').addEventListener('click', () => $('#modal').close());

  $('#tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.act;
    if (act === 'del') {
      if (confirm('Xóa bản ghi này?')) {
        await api(`/cham-cong/${id}`, { method: 'DELETE' });
        loadData();
      }
    }
    if (act === 'edit') {
      const row = st.items.find((x) => String(x.id) === String(id));
      if (row) openBatchModal(row);
    }
  });

  $('#fileExcel').addEventListener('change', onUploadExcel);
  $('#btn-export').addEventListener('click', async () => {
    const params = {};
    if ($('#nvId').value) params.nhan_vien_id = $('#nvId').value;
    if ($('#statusFilter').value) params.trang_thai = $('#statusFilter').value;
    if ($('#from').value) params.from = $('#from').value;
    if ($('#to').value) params.to = $('#to').value;
    if ($('#phongBanFilter').value)
      params.phong_ban_id = $('#phongBanFilter').value;
    const qs = new URLSearchParams(params);
    try {
      const res = await fetch(`/cham-cong/export?${qs}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) return alert('Lỗi xuất Excel');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ChamCong.xlsx';
      a.click();
    } catch (e) {
      alert('Lỗi tải file');
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
