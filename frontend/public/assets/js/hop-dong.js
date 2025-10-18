import { api, getUser, requireAuthOrRedirect, logout } from './api.js';

const state = {
  items: [],
  editing: null,
  saving: false,
};

function $(sel, root = document) {
  return root.querySelector(sel);
}

function esc(s) {
  return (s ?? '').toString().replace(
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
}

// Format ngày dd-mm-yyyy
function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString('vi-VN');
}

function unwrap(resp) {
  if (!resp) return [];
  if (Array.isArray(resp)) return resp;
  if (Array.isArray(resp.data)) return resp.data;
  return [];
}

// ===== Render bảng =====
function renderTable(user) {
  const body = $('#contractsBody');
  if (!state.items.length) {
    body.innerHTML = `<tr><td colspan="12" class="text-muted">Không có dữ liệu</td></tr>`;
    return;
  }

  body.innerHTML = state.items
    .map(
      (c) => `<tr>
        <td>${esc(c.id)}</td>
        <td>${esc(c.ho_ten || c.nhan_vien_id)}</td>
        <td>${esc(c.so_hop_dong || '')}</td>
        <td>${esc(c.loai_hop_dong || '')}</td>
        <td>${esc(formatDate(c.ngay_ky))}</td>
        <td>${esc(formatDate(c.ngay_bat_dau))}</td>
        <td>${esc(formatDate(c.ngay_ket_thuc))}</td>
        <td>${esc(c.luong_thoa_thuan || '')}</td>
        <td>${esc(c.phu_cap || '')}</td>
        <td>${esc(c.trang_thai || '')}</td>
        <td>${esc(c.ghi_chu || '')}</td>
        <td>
          ${
            c.file_hop_dong
              ? `<a href="${esc(
                  c.file_hop_dong
                )}" target="_blank" class="file-link">📄 Xem</a>`
              : ''
          }
        </td>
        <td class="pad">
            ${
              user.role === 'admin' || user.role === 'manager'
                ? `<button class="btn btn-sm btn-edit" data-action="edit" data-id="${c.id}">✏️</button>`
                : ''
            }
            ${
              user.role === 'admin'
                ? `<button class="btn btn-sm btn-del" data-action="del" data-id="${c.id}">🗑️</button>`
                : ''
            }
        </td>
      </tr>`
    )
    .join('');
}

// ===== Lấy danh sách =====
async function fetchList(user) {
  try {
    let url = '/hop-dong';
    if (user.role === 'employee') url = `/hop-dong?mine=1`;
    const resp = await api(url, { auth: true });
    state.items = unwrap(resp);
    renderTable(user);
  } catch (err) {
    alert(err?.message || 'Không tải được dữ liệu');
  }
}

// ===== Mở modal =====
function openModal(contract, user) {
  state.editing = contract || null;

  $('#modalTitle').textContent = contract
    ? `Sửa hợp đồng #${contract.id}`
    : 'Thêm hợp đồng';

  $('#contractId').value = contract?.id || '';
  $('#nhan_vien_id').value = contract?.nhan_vien_id || '';
  $('#so_hop_dong').value = contract?.so_hop_dong || '';
  $('#loai_hop_dong').value = contract?.loai_hop_dong || '';
  $('#ngay_ky').value = contract?.ngay_ky
    ? new Date(contract.ngay_ky).toISOString().split('T')[0]
    : '';
  $('#ngay_bat_dau').value = contract?.ngay_bat_dau
    ? new Date(contract.ngay_bat_dau).toISOString().split('T')[0]
    : '';
  $('#ngay_ket_thuc').value = contract?.ngay_ket_thuc
    ? new Date(contract.ngay_ket_thuc).toISOString().split('T')[0]
    : '';
  $('#luong_thoa_thuan').value = contract?.luong_thoa_thuan || '';
  $('#phu_cap').value = contract?.phu_cap || '';
  $('#trang_thai').value = contract?.trang_thai || 'con_hieu_luc';
  $('#ghi_chu').value = contract?.ghi_chu || '';

  document.querySelectorAll('.admin-only').forEach((el) => {
    el.style.display = user.role === 'admin' ? 'block' : 'none';
  });

  $('#contractModal').showModal();
}

function closeModal() {
  $('#contractModal').close();
}

// ===== Lưu hợp đồng =====
async function saveContract(user) {
  if (state.saving) return;
  state.saving = true;

  const btnSave = $('#btnSave');
  btnSave.disabled = true;
  btnSave.textContent = 'Đang lưu...';

  const id = $('#contractId').value;

  // Dùng FormData thay vì object thường
  const formData = new FormData();
  formData.append('so_hop_dong', $('#so_hop_dong').value || '');
  formData.append('phu_cap', $('#phu_cap').value || '');
  formData.append('ghi_chu', $('#ghi_chu').value || '');
  formData.append('trang_thai', $('#trang_thai').value || '');

  // Nếu có file thì append vào
  const file = $('#file_hop_dong')?.files[0];
  if (file) {
    formData.append('file_hop_dong', file);
  }

  if (user.role === 'admin') {
    formData.append('nhan_vien_id', $('#nhan_vien_id').value || '');
    formData.append('loai_hop_dong', $('#loai_hop_dong').value || '');
    formData.append('ngay_ky', $('#ngay_ky').value || '');
    formData.append('ngay_bat_dau', $('#ngay_bat_dau').value || '');
    formData.append('ngay_ket_thuc', $('#ngay_ket_thuc').value || '');
    formData.append('luong_thoa_thuan', $('#luong_thoa_thuan').value || '');
  }

  try {
    if (id) {
      await api(`/hop-dong/${id}`, {
        method: 'PUT',
        body: formData,
        auth: true,
        formData: true,
      });
    } else {
      await api(`/hop-dong`, {
        method: 'POST',
        body: formData,
        auth: true,
        formData: true,
      });
    }
    closeModal();
    await fetchList(user);
  } catch (err) {
    alert(err?.message || 'Lưu thất bại');
    if (!state.editing) {
      $('#contractId').value = '';
      state.editing = null;
    }
  } finally {
    state.saving = false;
    btnSave.disabled = false;
    btnSave.textContent = 'Lưu';
  }
}

// ===== Bind sự kiện =====
function bindEvents(user) {
  $('#btnCancel').addEventListener('click', closeModal);
  $('#contractForm').addEventListener('submit', (e) => {
    e.preventDefault();
    saveContract(user);
  });

  $('#btnAdd').addEventListener('click', () => openModal(null, user));

  $('#contractsBody').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const contract = state.items.find((c) => String(c.id) === String(id));

    if (action === 'edit') openModal(contract, user);
    if (action === 'del' && user.role === 'admin') {
      if (!confirm(`Xoá hợp đồng #${id}?`)) return;
      try {
        await api(`/hop-dong/${id}`, { method: 'DELETE', auth: true });
        await fetchList(user);
      } catch (err) {
        alert(err?.message || 'Không thể xoá');
      }
    }
  });
}

// ===== Khởi tạo =====
async function init() {
  requireAuthOrRedirect('./dang-nhap.html');
  const user = getUser();
  if (!user) return;

  if (user.role === 'admin') $('#btnAdd').classList.remove('hidden');
  else $('#actionsCol').textContent = 'Thao tác';

  await fetchList(user);
  bindEvents(user);

  // Hiển thị user
  $('#user-badge').textContent = user.username || user.full_name || 'User';

  // Nút logout
  $('#logout-btn').addEventListener('click', () => {
    logout();
    window.location.href = './dang-nhap.html';
  });

  $('#y').textContent = new Date().getFullYear();
}

document.addEventListener('DOMContentLoaded', init);
