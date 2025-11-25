// ================== IMPORT ==================
import { api, getUser, requireAuthOrRedirect } from './api.js';

const API_URL = '/tai-khoan';

const tbody = document.getElementById('tbody');
const modal = document.getElementById('modal');
const form = document.getElementById('form');
const modalTitle = document.getElementById('modal-title');
const btnCreate = document.getElementById('btn-create');
const btnCancel = document.getElementById('btn-cancel');
const errorBox = document.getElementById('modal-error');

let editingId = null;

// ================== KIỂM TRA QUYỀN ==================
// Quyền Admin: Có toàn quyền quản lý Tài khoản
function isAdmin() {
  const role = getUser()?.role ?? getUser()?.quyen ?? 'employee';
  return role === 'admin';
}
// Quyền Manage: Chỉ được xem danh sách (Admin/Manager)
function canManage() {
  const role = getUser()?.role ?? getUser()?.quyen ?? 'employee';
  return role === 'admin' || role === 'manager';
}

// Ẩn nút "Thêm tài khoản" nếu không phải Admin
if (!isAdmin()) {
  btnCreate.style.display = 'none';
}

// ================== LOAD DANH SÁCH ==================
async function loadTaiKhoan() {
  if (!canManage()) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-danger">Bạn không có quyền xem danh sách tài khoản.</td></tr>`;
    return;
  }

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

  // Lấy role của người dùng hiện tại để hiển thị/ẩn nút
  const userRole = getUser()?.role ?? getUser()?.quyen ?? 'employee';

  tbody.innerHTML = list
    .map(
      (tk) => `
    <tr>
      <td data-label="ID">${tk.id}</td>
      <td data-label="Nhân viên">${tk.ho_ten || ''}</td>
      <td data-label="Tên đăng nhập">${tk.ten_dang_nhap}</td>
      <td data-label="Chức vụ">${tk.ten_chuc_vu || ''}</td>
      <td data-label="Trạng thái">${
        tk.trang_thai === 'active' ? 'Hoạt động' : 'Khóa'
      }</td>
      <td data-label="Ngày tạo">${
        tk.created_at ? new Date(tk.created_at).toLocaleDateString('vi-VN') : ''
      }</td>
      <td data-label="Thao tác">
        ${
          // Chỉ Admin được Sửa/Xóa
          userRole === 'admin'
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
async function openModalEdit(id) {
  if (!isAdmin()) {
    // Chỉ Admin được Sửa
    alert('Chỉ Admin được sửa tài khoản');
    return;
  }

  editingId = id;
  modalTitle.textContent = 'Sửa tài khoản';
  errorBox.hidden = true;
  form.reset();

  try {
    const tk = await api(`${API_URL}/${id}`, { method: 'GET' });
    if (!tk) throw new Error('Không tìm thấy tài khoản');

    const mNvName = form.querySelector('#m-nvName');
    const mNvId = form.querySelector('#m-nvId');
    const mUsername = form.querySelector('#m-username');
    const mTrangThai = form.querySelector('#m-trangThai');

    // Điền dữ liệu
    mNvName.value = tk.ho_ten || '';
    mNvId.value = tk.nhan_vien_id;
    mUsername.value = tk.ten_dang_nhap;
    mTrangThai.value = tk.trang_thai === 'active' ? '1' : '0';

    // Khóa trường không cho sửa khi chỉnh sửa
    mNvName.disabled = true;
    mUsername.disabled = true;

    modal.showModal();
  } catch (err) {
    alert('Không thể tải dữ liệu tài khoản: ' + err.message);
  }
}

btnCreate.onclick = () => {
  if (!isAdmin()) {
    // Chỉ Admin được Tạo
    alert('Chỉ Admin được tạo tài khoản');
    return;
  }
  editingId = null;
  form.reset();
  modalTitle.textContent = 'Thêm tài khoản';
  errorBox.hidden = true;

  // Mở khóa các trường khi Tạo mới
  form.querySelector('#m-nvName').disabled = false;
  form.querySelector('#m-username').disabled = false;

  modal.showModal();
};

btnCancel.onclick = () => modal.close();

// ================== SUBMIT FORM ==================
form.onsubmit = async (e) => {
  e.preventDefault();

  if (!isAdmin()) {
    alert('Chỉ Admin được thực hiện thao tác này.');
    return;
  }

  const mPassword = form.querySelector('#m-password');

  const body = {
    nhan_vien_id: Number(form.querySelector('#m-nvId').value),
    ten_dang_nhap: form.querySelector('#m-username').value.trim(),
    mat_khau: mPassword.value || undefined,
    trang_thai:
      form.querySelector('#m-trangThai').value === '1' ? 'active' : 'inactive',
  };

  if (!editingId && !body.mat_khau) {
    body.mat_khau = '123456';
  }

  if (editingId && !body.mat_khau) {
    delete body.mat_khau;
  }

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
  if (!isAdmin()) {
    // Chỉ Admin được Xóa
    alert('Chỉ Admin được xoá');
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
requireAuthOrRedirect('./dang-nhap.html');

if (canManage()) {
  loadTaiKhoan();
} else {
  tbody.innerHTML = `<tr><td colspan="7" class="text-danger">Bạn không có quyền xem trang này.</td></tr>`;
}
