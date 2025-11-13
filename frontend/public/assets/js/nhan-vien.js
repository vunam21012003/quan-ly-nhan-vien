import {
  api,
  getUser,
  getToken,
  clearAuth,
  requireAuthOrRedirect,
} from './api.js';

const st = {
  list: [],
  page: 1,
  limit: 10,
  total: 0,
  editingId: null,
  // Thêm các biến state để quản lý quyền
  USER: null,
  ROLE: null,
  IS_ADMIN: false,
  IS_MANAGER_OR_ADMIN: false,
  phongBans: [],
  chucVus: [],
};

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

function setUserBadge() {
  const b = $('#user-badge');
  if (!b) return;
  if (!st.USER) {
    b.className = 'badge badge-warn';
    b.textContent = 'Chưa đăng nhập';
    return;
  }

  b.className = 'badge badge-ok';
  b.textContent = `User: ${st.USER.username ?? st.USER.ten_dang_nhap ?? ''} • ${
    st.ROLE
  }`;

  // Ẩn nút tạo nếu không phải Admin hoặc Manager
  if (!st.IS_MANAGER_OR_ADMIN) {
    $('#nv-btn-create').style.display = 'none';
  }
}

function rowHtml(x) {
  const isEmployeeSelf =
    st.ROLE === 'employee' && st.USER.nhan_vien_id === x.id;
  const actionButtons = st.IS_MANAGER_OR_ADMIN
    ? `
        <button class="page-btn btn-sm" data-act="view">Xem</button>
        <button class="page-btn btn-sm" data-act="edit">Sửa</button>
        <button class="page-btn btn-sm" data-act="del">Xoá</button>
      `
    : `
        <button class="page-btn btn-sm" data-act="view">Xem</button>
        ${
          isEmployeeSelf
            ? '<span class="text-muted">—</span>'
            : '<span class="text-muted">—</span>'
        }
      `;

  return `<tr data-id="${x.id}">
    <td>${x.id}</td>
    <td>${esc(x.ho_ten)}</td>
    <td>${esc(x.gioi_tinh || '')}</td>
    <td>${esc(x.ten_phong_ban || '')}</td>
    <td>${esc(x.ten_chuc_vu || '')}</td>
    <td class="td-email">${esc(x.email || '')}</td>
    <td class="td-sdt">${esc(x.so_dien_thoai || '')}</td>
    <td class="td-ngayvao">${
      x.ngay_vao_lam ? new Date(x.ngay_vao_lam).toLocaleDateString('vi-VN') : ''
    }</td>
    <td class="td-trangthai">${esc(x.trang_thai || '')}</td>
    <td class="td-actions">${actionButtons}</td>
  </tr>`;
}

function unwrap(r) {
  const d = r?.data ?? r;
  if (d?.items) return { items: d.items, total: d.total ?? d.items.length };
  return { items: d?.list ?? [], total: d?.total ?? 0 };
}

async function loadPhongBans() {
  const res = await api('/phong-ban?limit=500').catch(() => ({
    data: { items: [] },
  }));
  const items = res?.data?.items || res.items || [];
  st.phongBans = items;

  // dropdown lọc
  const selPB = $('#nv-phongban');
  selPB.innerHTML =
    `<option value="">-- Tất cả phòng ban --</option>` +
    items.map((x) => `<option value="${x.id}">${esc(x.ten)}</option>`).join('');

  // dropdown trong form thêm/sửa
  const selPBForm = $('#nv-phong_ban_id');
  selPBForm.innerHTML =
    `<option value="">-- Chọn phòng ban --</option>` +
    items.map((x) => `<option value="${x.id}">${esc(x.ten)}</option>`).join('');

  // khi chọn phòng ban -> load chức vụ tương ứng
  selPBForm.addEventListener('change', async () => {
    const phongBanId = selPBForm.value;
    await loadChucVus(phongBanId);
  });
}

async function loadChucVus(phongBanId = '') {
  const url = phongBanId
    ? `/chuc-vu?phong_ban_id=${phongBanId}&limit=500`
    : '/chuc-vu?limit=500';
  const res = await api(url).catch(() => ({ data: { items: [] } }));
  const items = res?.data?.items || res.items || [];
  st.chucVus = items;

  // dropdown lọc ngoài danh sách
  const selCV = $('#nv-chucvu');
  selCV.innerHTML =
    `<option value="">-- Tất cả chức vụ --</option>` +
    items
      .map(
        (x) =>
          `<option value="${x.id}">${esc(x.ten_chuc_vu)} (${esc(
            x.ten_phong_ban || ''
          )})</option>`
      )
      .join('');

  // dropdown trong form thêm/sửa
  const selCVForm = $('#nv-chuc_vu_id');
  selCVForm.innerHTML =
    `<option value="">-- Chọn chức vụ --</option>` +
    items
      .map((x) => `<option value="${x.id}">${esc(x.ten_chuc_vu)}</option>`)
      .join('');
}

async function fetchList() {
  const qs = new URLSearchParams({
    page: String(st.page),
    limit: String(st.limit),
    search: $('#nv-search').value.trim(),
    phong_ban_id: $('#nv-phongban').value || '',
    chuc_vu_id: $('#nv-chucvu').value || '',
  });
  const res = await api(`/nhan-vien?${qs.toString()}`).catch(() => ({
    data: { items: [], total: 0 },
  }));
  const d = res?.data?.data ?? res?.data ?? res;
  st.list = d.items ?? [];
  st.total = d.total ?? st.list.length;

  $('#nv-tbody').innerHTML = st.list.length
    ? st.list.map(rowHtml).join('')
    : `<tr><td colspan="10" class="text-muted">Không có dữ liệu</td></tr>`;
  renderPaging();

  // THÊM: Tự động mở chi tiết cho Employee
  if (
    st.ROLE === 'employee' &&
    st.list.length === 1 &&
    st.list[0].id === st.USER.nhan_vien_id
  ) {
    openModal(st.list[0], 'view');
  }
}

function renderPaging() {
  const totalPages = Math.ceil((st.total || 0) / (st.limit || 10));
  const c = $('#nv-pagination');
  if (totalPages <= 1) {
    c.innerHTML = '';
    return;
  }
  let html = '';
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn ${
      i === st.page ? 'btn-primary' : ''
    }" data-page="${i}">${i}</button>`;
  }
  c.innerHTML = html;
  c.querySelectorAll('button[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      st.page = Number(btn.dataset.page);
      fetchList();
    });
  });
}

// SỬA: Thêm tham số mode ('edit'/'view')
function openModal(item = null, mode = 'edit') {
  const isView = mode === 'view' || item === null;

  st.editingId = item?.id ?? null;

  $('#nv-modal-title').textContent =
    isView && item
      ? `Chi tiết nhân viên #${item.id}`
      : item
      ? `Sửa nhân viên #${item.id}`
      : 'Thêm nhân viên';

  // Điền dữ liệu
  $('#nv-ho_ten').value = item?.ho_ten ?? '';
  $('#nv-gioi_tinh').value = item?.gioi_tinh ?? 'Nam';
  $('#nv-ngay_sinh').value = item?.ngay_sinh
    ? item.ngay_sinh.split('T')[0]
    : '';
  $('#nv-email').value = item?.email ?? '';
  $('#nv-so_dien_thoai').value = item?.so_dien_thoai ?? '';
  $('#nv-dia_chi').value = item?.dia_chi ?? '';
  $('#nv-phong_ban_id').value = item?.phong_ban_id ?? '';
  $('#nv-trang_thai').value = item?.trang_thai ?? 'dang_lam';
  $('#nv-ghi_chu').value = item?.ghi_chu ?? '';
  $('#nv-ngay_vao_lam').value = item?.ngay_vao_lam
    ? item.ngay_vao_lam.split('T')[0]
    : '';

  $('#nv-error').hidden = true;

  // Tải lại chức vụ theo phòng ban hiện tại và chọn giá trị
  const phongBanId = item?.phong_ban_id ?? '';
  loadChucVus(phongBanId).then(() => {
    $('#nv-chuc_vu_id').value = item?.chuc_vu_id ?? '';
  });

  // Đặt chế độ xem/sửa
  const allInputs = $('#nv-form').querySelectorAll('input, select, textarea');
  allInputs.forEach((input) => {
    // Chỉ cho phép nhập/chọn nếu mode là edit (và không phải view)
    input.readOnly = isView;
    input.disabled = isView;
    // Bỏ thuộc tính disabled cho nút Save (chỉ áp dụng cho input)
  });

  const saveBtn = $('#nv-save');
  const cancelBtn = $('#nv-cancel');

  // Ẩn nút Lưu nếu là chế độ Xem
  saveBtn.style.display = isView && item ? 'none' : 'block';
  // Đổi tên nút Hủy thành Đóng nếu là chế độ Xem
  cancelBtn.textContent = isView && item ? 'Đóng' : 'Hủy';

  $('#nv-modal').showModal();
}

function closeModal() {
  $('#nv-modal').close();
}

// Hàm này không cần thiết vì logic quyền đã chuyển sang st.IS_MANAGER_OR_ADMIN
// function canEditOrDelete() {
//   return st.ROLE === 'admin' || st.ROLE === 'manager';
// }

function bind() {
  $('#nv-btn-refresh').addEventListener('click', () => {
    st.page = 1;
    $('#nv-search').value = '';
    $('#nv-phongban').value = '';
    $('#nv-chucvu').value = '';
    fetchList();
  });
  $('#nv-btn-search').addEventListener('click', () => {
    st.page = 1;
    fetchList();
  });

  // SỬA: Kiểm tra quyền trước khi mở form Thêm
  $('#nv-btn-create').addEventListener('click', () =>
    st.IS_MANAGER_OR_ADMIN
      ? openModal(null, 'edit')
      : alert('Bạn không có quyền tạo nhân viên')
  );

  $('#nv-cancel').addEventListener('click', closeModal);

  $('#nv-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!st.IS_MANAGER_OR_ADMIN) {
      showErr('Bạn không có quyền thực hiện thao tác này.');
      return;
    }

    // Logic lưu giữ nguyên
    const payload = {
      ho_ten: $('#nv-ho_ten').value.trim(),
      gioi_tinh: $('#nv-gioi_tinh').value || 'Nam',
      ngay_sinh: $('#nv-ngay_sinh').value || null,
      email: $('#nv-email').value || null,
      so_dien_thoai: $('#nv-so_dien_thoai').value || null,
      dia_chi: $('#nv-dia_chi').value || null,
      phong_ban_id: Number($('#nv-phong_ban_id').value) || null,
      chuc_vu_id: Number($('#nv-chuc_vu_id').value) || null,
      ngay_vao_lam: $('#nv-ngay_vao_lam').value || null,
      trang_thai: $('#nv-trang_thai').value || 'dang_lam',
      ghi_chu: $('#nv-ghi_chu').value || null,
    };
    if (!payload.ho_ten) {
      showErr('Vui lòng nhập họ tên');
      return;
    }
    try {
      if (st.editingId) {
        await api(`/nhan-vien/${st.editingId}`, {
          method: 'PUT',
          body: payload,
        });
      } else {
        await api('/nhan-vien', { method: 'POST', body: payload });
      }
      closeModal();
      await fetchList();
    } catch (err) {
      showErr(err?.message || 'Lưu thất bại');
    }
  });

  $('#nv-tbody').addEventListener('click', async (e) => {
    const row = e.target.closest('tr[data-id]');
    if (!row) return;
    const id = row.dataset.id;
    const btn = e.target.closest('button.page-btn');
    if (!btn) return;
    const act = btn.dataset.act;
    const item = st.list.find((x) => String(x.id) === String(id));

    if (act === 'view') {
      openModal(item, 'view');
    }

    // Sửa và Xóa chỉ cho phép nếu là Admin/Manager và không phải đang ở chế độ xem
    if (act === 'edit') {
      if (!st.IS_MANAGER_OR_ADMIN) return alert('Bạn không có quyền');
      openModal(item, 'edit');
    }

    if (act === 'del') {
      if (!st.IS_MANAGER_OR_ADMIN) return alert('Bạn không có quyền');
      if (!confirm(`Xoá nhân viên #${id}?`)) return;

      try {
        await api(`/nhan-vien/${id}`, { method: 'DELETE' });
        await fetchList();
      } catch (err) {
        alert(err?.message || 'Không thể xoá');
      }
    }
  });

  $('#logout-btn').addEventListener('click', () => {
    clearAuth();
    location.href = './dangnhap.html';
  });
}

function showErr(m) {
  const el = $('#nv-error');
  el.hidden = false;
  el.textContent = m;
}

async function init() {
  requireAuthOrRedirect('./dangnhap.html');
  if (!getToken()) return;

  // Thiết lập quyền và vai trò
  st.USER = getUser();
  st.ROLE = st.USER?.role ?? st.USER?.quyen ?? 'employee';
  st.IS_ADMIN = st.ROLE === 'admin';
  st.IS_MANAGER_OR_ADMIN = st.ROLE === 'admin' || st.ROLE === 'manager';

  const yearEl = document.getElementById('y');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  setUserBadge();
  await loadPhongBans();
  await loadChucVus();
  await fetchList();
  bind();
}
document.addEventListener('DOMContentLoaded', init);
