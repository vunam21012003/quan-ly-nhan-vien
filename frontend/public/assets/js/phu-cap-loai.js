import { api, requireAuthOrRedirect, getToken } from './api.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) =>
  (s ?? '').toString().replace(/[&<>"']/g, (m) => {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }[m];
  });

let state = {
  items: [],
  editingId: null,
};

let CURRENT_USER = JSON.parse(localStorage.getItem('hr_user') || '{}');
const ROLE = (CURRENT_USER.role || 'employee').toLowerCase();

// LOAD LOẠI PHỤ CẤP
async function loadLoai() {
  const res = await api('/phu-cap-loai').catch(() => ({ data: [] }));

  // Đúng chuẩn API của bạn
  const data = res.data ?? res ?? [];

  state.items = Array.isArray(data) ? data : [];

  renderLoai();
}

// HIỂN THỊ TABLE
function renderLoai() {
  const body = $('#loai-body');

  if (!state.items.length) {
    body.innerHTML = `<tr><td colspan="7" class="text-muted">Không có dữ liệu</td></tr>`;
    return;
  }

  body.innerHTML = state.items
    .map(
      (x) => `
      <tr>
        <td>${x.id}</td>
        <td>${esc(x.ten)}</td>
        <td>${esc(x.mo_ta || '')}</td>

        <!-- is_fixed -->
        <td>${x.is_fixed == 1 ? 'Cố định' : 'Theo tháng'}</td>

        <!-- tinh_bhxh -->
        <td>${x.tinh_bhxh == 1 ? 'Có' : 'Không'}</td>

        <!-- mac_dinh -->
        <td>${Number(x.mac_dinh || 0).toLocaleString('vi-VN')}</td>

        <td>
          ${
            ROLE === 'admin'
              ? `
                <button class="btn btn-sm btn-edit" data-id="${x.id}"><i class="fa-solid fa-pen" style="color:#3ef69d"></i></button>
                <button class="btn btn-sm btn-del" data-id="${x.id}"><i class="fa-solid fa-trash" style="color:#e4b721"></i></button>
              `
              : ``
          }
        </td>
      </tr>
    `
    )
    .join('');
}

// MỞ MODAL
function openLoaiModal(item = null) {
  if (ROLE !== 'admin') {
    alert('Bạn không có quyền thao tác loại phụ cấp!');
    return;
  }
  state.editingId = item?.id ?? null;

  $('#loai-title').textContent = item
    ? 'Sửa loại phụ cấp'
    : 'Thêm loại phụ cấp';

  $('#loai-id').value = item?.id ?? '';
  $('#loai-ten').value = item?.ten ?? '';
  $('#loai-mo-ta').value = item?.mo_ta ?? '';
  $('#loai-is-fixed').value = item?.is_fixed ?? 1;
  $('#loai-tinh-bhxh').checked = item?.tinh_bhxh ? true : false;
  $('#loai-mac-dinh').value = item?.mac_dinh ?? 0;

  $('#loai-error').hidden = true;
  $('#modal-loai').showModal();
}

function closeLoaiModal() {
  $('#modal-loai').close();
}

// LƯU
async function saveLoai(e) {
  e.preventDefault();
  $('#loai-error').hidden = true;

  const payload = {
    ten: $('#loai-ten').value.trim(),
    mo_ta: $('#loai-mo-ta').value.trim(),
    is_fixed: Number($('#loai-is-fixed').value),
    tinh_bhxh: $('#loai-tinh-bhxh').checked ? 1 : 0,
    mac_dinh: Number($('#loai-mac-dinh').value || 0),
  };

  if (!payload.ten) {
    $('#loai-error').textContent = 'Tên phụ cấp bắt buộc!';
    $('#loai-error').hidden = false;
    return;
  }

  try {
    if (state.editingId) {
      await api(`/phu-cap-loai/${state.editingId}`, {
        method: 'PUT',
        body: payload,
      });
    } else {
      await api('/phu-cap-loai', { method: 'POST', body: payload });
    }

    closeLoaiModal();
    await loadLoai();
  } catch (err) {
    $('#loai-error').textContent = err?.message || 'Lỗi không xác định!';
    $('#loai-error').hidden = false;
  }
}

// XOÁ
async function deleteLoai(id) {
  if (!confirm(`Bạn chắc chắn muốn xóa loại phụ cấp #${id}?`)) return;
  await api(`/phu-cap-loai/${id}`, { method: 'DELETE' });
  await loadLoai();
}

// BIND
function bindLoaiEvents() {
  if (ROLE !== 'admin') {
    $('#btn-add-loai').style.display = 'none';
  } else {
    $('#btn-add-loai').addEventListener('click', () => openLoaiModal());
  }

  $('#btn-cancel-loai').addEventListener('click', closeLoaiModal);
  $('#form-loai').addEventListener('submit', saveLoai);

  $('#loai-body').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const id = btn.dataset.id;

    if (btn.classList.contains('btn-edit')) {
      const item = state.items.find((x) => x.id == id);
      openLoaiModal(item);
    }

    if (btn.classList.contains('btn-del')) {
      deleteLoai(id);
    }
  });
}

// INIT
async function init() {
  requireAuthOrRedirect('./dang-nhap.html');
  if (!getToken()) return;

  await loadLoai();
  bindLoaiEvents();
}

document.addEventListener('DOMContentLoaded', init);
