// ================== IMPORT ==================
import { api, getUser, requireAuthOrRedirect } from './api.js';

const API_URL = '/tai-khoan'; // ✅ Gọi trực tiếp, api() sẽ tự nối http://localhost:8001

const tbody = document.getElementById('tbody');
const modal = document.getElementById('modal');
const form = document.getElementById('form');
const modalTitle = document.getElementById('modal-title');
const btnCreate = document.getElementById('btn-create');
const btnCancel = document.getElementById('btn-cancel');
const errorBox = document.getElementById('modal-error');

let editingId = null;

// ================== KIỂM TRA QUYỀN ==================
function canManage() {
  const u = getUser();
  const role = u?.role ?? u?.quyen ?? 'employee';
  return role === 'admin' || role === 'manager';
}

// ================== LOAD DANH SÁCH ==================
async function loadTaiKhoan() {
  try {
    const res = await api(API_URL, { method: 'GET' });
    const data = Array.isArray(res) ? res : res?.data ?? [];
    renderTable(data);
  } catch (err) {
    console.error('❌ Lỗi tải danh sách tài khoản:', err);
    tbody.innerHTML = `<tr><td colspan="7" class="text-danger">Không thể tải dữ liệu (${err.message})</td></tr>`;
  }
}

// ================== RENDER BẢNG ==================
function renderTable(list) {
  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-muted">Không có dữ liệu</td></tr>`;
    return;
  }

  tbody.innerHTML = list
    .map(
      (tk) => `
    <tr>
      <td>${tk.id}</td>
      <td>${tk.ho_ten || ''}</td>
      <td>${tk.ten_dang_nhap}</td>
      <td>${tk.ten_chuc_vu || ''}</td>
      <td>${tk.trang_thai === 'active' ? 'Hoạt động' : 'Khóa'}</td>
      <td>${
        tk.created_at ? new Date(tk.created_at).toLocaleDateString('vi-VN') : ''
      }</td>
      <td>
        ${
          canManage()
            ? `
            <button class="btn-edit" data-id="${tk.id}">✏️</button>
            <button class="btn-delete" data-id="${tk.id}">🗑️</button>`
            : ''
        }
      </td>
    </tr>`
    )
    .join('');

  document
    .querySelectorAll('.btn-edit')
    .forEach((b) =>
      b.addEventListener('click', () => openModalEdit(b.dataset.id))
    );
  document
    .querySelectorAll('.btn-delete')
    .forEach((b) =>
      b.addEventListener('click', () => handleDelete(b.dataset.id))
    );
}

// ================== MODAL ==================
function openModalEdit(id) {
  editingId = id;
  modalTitle.textContent = 'Sửa tài khoản';
  modal.showModal();
}

btnCreate.onclick = () => {
  if (!canManage()) {
    alert('Chỉ Admin/Manager được tạo tài khoản');
    return;
  }
  editingId = null;
  form.reset();
  modalTitle.textContent = 'Thêm tài khoản';
  errorBox.hidden = true;
  modal.showModal();
};

btnCancel.onclick = () => modal.close();

// ================== SUBMIT FORM ==================
form.onsubmit = async (e) => {
  e.preventDefault();

  const body = {
    nhan_vien_id: Number(form.querySelector('#m-nvId').value),
    chuc_vu_id: Number(form.querySelector('#m-chucVu').value) || null,
    ten_dang_nhap: form.querySelector('#m-username').value.trim(),
    mat_khau: form.querySelector('#m-password').value || '123456',
    trang_thai:
      form.querySelector('#m-trangThai').value === '1' ? 'active' : 'inactive',
  };

  try {
    if (editingId) {
      await api(`${API_URL}/${editingId}`, { method: 'PUT', body });
    } else {
      await api(API_URL, { method: 'POST', body });
    }

    modal.close();
    await loadTaiKhoan();
  } catch (err) {
    errorBox.hidden = false;
    errorBox.textContent = err.message || 'Lỗi khi lưu dữ liệu';
  }
};

// ================== XÓA ==================
async function handleDelete(id) {
  if (!canManage()) {
    alert('Chỉ Admin/Manager được xoá');
    return;
  }
  if (!confirm('Xóa tài khoản này?')) return;

  try {
    await api(`${API_URL}/${id}`, { method: 'DELETE' });
    await loadTaiKhoan();
  } catch (err) {
    alert('Không thể xóa tài khoản: ' + err.message);
  }
}

// ================== KHỞI ĐỘNG ==================
requireAuthOrRedirect('./dangnhap.html');
loadTaiKhoan();
