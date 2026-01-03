// ================== IMPORT ==================
import { api, getUser, requireAuthOrRedirect } from './api.js';

const API_URL = '/tai-khoan';
const NHAN_VIEN_URL = '/nhan-vien';
const CHUC_VU_URL = '/chuc-vu';

const tbody = document.getElementById('tbody');
const modal = document.getElementById('modal');
const form = document.getElementById('form');
const modalTitle = document.getElementById('modal-title');
const btnCreate = document.getElementById('btn-create');
const btnCancel = document.getElementById('btn-cancel');
const errorBox = document.getElementById('modal-error');

// Filters & Pagination
const searchName = document.getElementById('searchName');
const chucVuFilter = document.getElementById('chucVuFilter');
const trangThaiFilter = document.getElementById('trangThaiFilter');
const btnSearch = document.getElementById('btn-search');
const btnRefresh = document.getElementById('btn-refresh');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const pageInfo = document.getElementById('pageInfo');

// Autocomplete nhân viên
const nvNameInput = document.getElementById('m-nvName');
const nvIdInput = document.getElementById('m-nvId');
const nvAutocompleteList = document.getElementById('nv-autocomplete-list');

let editingId = null;
const st = { page: 1, limit: 20, total: 0 };

// ================== KIỂM TRA QUYỀN ==================
function isAdmin() {
  const role = getUser()?.role ?? getUser()?.quyen ?? 'employee';
  return role === 'admin';
}

function canManage() {
  const role = getUser()?.role ?? getUser()?.quyen ?? 'employee';
  return role === 'admin' || role === 'manager';
}

// Ẩn nút tạo nếu không phải Admin
if (!isAdmin()) {
  btnCreate.style.display = 'none';
}

// ================== LOAD CHỨC VỤ CHO FILTER ==================
async function loadChucVu() {
  try {
    const res = await api(CHUC_VU_URL);
    const items = Array.isArray(res) ? res : res?.items ?? res?.data ?? [];

    chucVuFilter.innerHTML =
      '<option value="">-- Tất cả chức vụ --</option>' +
      items
        .map((cv) => `<option value="${cv.id}">${cv.ten_chuc_vu}</option>`)
        .join('');
  } catch (err) {
    console.warn('Không tải được danh sách chức vụ:', err);
  }
}

// ================== FETCH LIST VỚI FILTER & PAGINATION ==================
async function fetchList() {
  const qs = new URLSearchParams({
    page: String(st.page),
    limit: String(st.limit),
  });

  // Lấy giá trị filter từ UI
  const search = searchName.value.trim();
  const chucVu = chucVuFilter.value;
  const trangThai = trangThaiFilter.value;

  if (search) qs.set('search', search);
  if (chucVu) qs.set('chuc_vu_id', chucVu);
  if (trangThai) qs.set('trang_thai', trangThai);

  try {
    const res = await api(`${API_URL}?${qs.toString()}`);
    const { items = [], total = 0 } = unwrap(res);

    st.items = items;
    st.total = total;

    renderTable(items);
    updatePagination();
  } catch (err) {
    console.error('Lỗi tải danh sách:', err);
    tbody.innerHTML = `<tr><td colspan="7" class="text-danger">Không thể tải dữ liệu (${err.message})</td></tr>`;
  }
}

// Helper unwrap API response
function unwrap(r) {
  const d = r?.data ?? r;
  if (Array.isArray(d)) return { items: d, total: d.length };
  if (d?.items) return { items: d.items, total: d.total ?? d.items.length };
  return { items: d ?? [], total: 0 };
}

// ================== UPDATE PAGINATION ==================
function updatePagination() {
  const totalPages = Math.ceil(st.total / st.limit);
  pageInfo.textContent = `Trang ${st.page}/${totalPages || 1}`;

  prevBtn.disabled = st.page <= 1;
  nextBtn.disabled = st.page >= totalPages;
}

// ================== RENDER BẢNG ==================
function renderTable(list) {
  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-muted">Không có dữ liệu phù hợp</td></tr>`;
    return;
  }

  const userRole = getUser()?.role ?? 'employee';

  tbody.innerHTML = list
    .map(
      (tk) => `
      <tr>
        <td data-label="ID">${tk.id}</td>
        <td data-label="Nhân viên">${tk.ho_ten || ''}</td>
        <td data-label="Tên đăng nhập">${tk.ten_dang_nhap || ''}</td>
        <td data-label="Chức vụ">${tk.ten_chuc_vu || ''}</td>
        <td data-label="Trạng thái">${
          tk.trang_thai === 'active' ? 'Hoạt động' : 'Khóa'
        }</td>
        <td data-label="Ngày tạo">${
          tk.created_at
            ? new Date(tk.created_at).toLocaleDateString('vi-VN')
            : ''
        }</td>
        <td data-label="Thao tác">
          ${
            userRole === 'admin'
              ? `
            <button class="btn-edit page-btn" data-id="${tk.id}">✏️</button>
            <button class="btn-delete page-btn" data-id="${tk.id}">🗑️</button>
          `
              : ''
          }
        </td>
      </tr>
    `
    )
    .join('');

  // Bind events cho các nút mới render
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

// ================== AUTOCOMPLETE NHÂN VIÊN ==================
nvNameInput.addEventListener('input', async () => {
  const term = nvNameInput.value.trim();
  if (term.length < 2) {
    nvAutocompleteList.innerHTML = '';
    return;
  }

  try {
    const res = await api(
      `${NHAN_VIEN_URL}?search=${encodeURIComponent(term)}&limit=10`
    );
    const items = Array.isArray(res) ? res : res?.items ?? [];

    nvAutocompleteList.innerHTML = items
      .map(
        (nv) => `
      <div class="autocomplete-item" data-id="${nv.id}">
        ${nv.ho_ten} (ID: ${nv.id})
      </div>
    `
      )
      .join('');

    // Click chọn
    document.querySelectorAll('.autocomplete-item').forEach((item) => {
      item.addEventListener('click', () => {
        nvNameInput.value = item.textContent;
        nvIdInput.value = item.dataset.id;
        nvAutocompleteList.innerHTML = '';
      });
    });
  } catch (err) {
    console.warn('Lỗi tìm nhân viên:', err);
  }
});

// Ẩn autocomplete khi click ngoài
document.addEventListener('click', (e) => {
  if (
    !nvNameInput.contains(e.target) &&
    !nvAutocompleteList.contains(e.target)
  ) {
    nvAutocompleteList.innerHTML = '';
  }
});

// ================== MODAL ==================
async function openModalEdit(id) {
  if (!isAdmin()) {
    alert('Chỉ Admin được sửa tài khoản');
    return;
  }

  editingId = id;
  modalTitle.textContent = 'Sửa tài khoản';
  errorBox.hidden = true;
  form.reset();

  try {
    const tk = await api(`${API_URL}/${id}`);
    if (!tk) throw new Error('Không tìm thấy tài khoản');

    nvNameInput.value = tk.ho_ten || '';
    nvIdInput.value = tk.nhan_vien_id || '';
    form.querySelector('#m-username').value = tk.ten_dang_nhap || '';
    form.querySelector('#m-trangThai').value =
      tk.trang_thai === 'active' ? '1' : '0';

    // Khóa trường không cho sửa
    nvNameInput.disabled = true;
    form.querySelector('#m-username').disabled = true;

    modal.showModal();
  } catch (err) {
    alert('Không thể tải dữ liệu: ' + err.message);
  }
}

btnCreate.onclick = () => {
  if (!isAdmin()) {
    alert('Chỉ Admin được tạo tài khoản');
    return;
  }
  editingId = null;
  form.reset();
  modalTitle.textContent = 'Thêm tài khoản';
  errorBox.hidden = true;
  nvNameInput.disabled = false;
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

  if (!nvIdInput.value) {
    errorBox.hidden = false;
    errorBox.textContent = 'Vui lòng chọn nhân viên';
    return;
  }

  const mPassword = form.querySelector('#m-password');
  const body = {
    nhan_vien_id: Number(nvIdInput.value),
    ten_dang_nhap: form.querySelector('#m-username').value.trim(),
    mat_khau: mPassword.value || undefined,
    trang_thai:
      form.querySelector('#m-trangThai').value === '1' ? 'active' : 'inactive',
  };

  if (!editingId && !body.mat_khau) {
    body.mat_khau = '123456';
  } else if (editingId && !body.mat_khau) {
    delete body.mat_khau;
  }

  try {
    if (editingId) {
      await api(`${API_URL}/${editingId}`, { method: 'PUT', body });
    } else {
      await api(API_URL, { method: 'POST', body });
    }
    modal.close();
    st.page = 1; // Reset về trang 1 sau khi lưu
    await fetchList();
  } catch (err) {
    errorBox.hidden = false;
    errorBox.textContent = err.message || 'Lỗi khi lưu dữ liệu';
  }
};

// ================== XÓA ==================
async function handleDelete(id) {
  if (!isAdmin()) {
    alert('Chỉ Admin được xóa');
    return;
  }
  if (!confirm('Xóa tài khoản này?')) return;

  try {
    await api(`${API_URL}/${id}`, { method: 'DELETE' });
    await fetchList();
  } catch (err) {
    alert('Không thể xóa: ' + err.message);
  }
}

// ================== BIND EVENTS ==================
function bind() {
  // Filters
  btnSearch.onclick = () => {
    st.page = 1;
    fetchList();
  };
  btnRefresh.onclick = () => {
    searchName.value = '';
    chucVuFilter.value = '';
    trangThaiFilter.value = '';
    st.page = 1;
    fetchList();
  };

  // Debounce search input
  let searchTimeout;
  searchName.oninput = () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      st.page = 1;
      fetchList();
    }, 500);
  };

  chucVuFilter.onchange = () => {
    st.page = 1;
    fetchList();
  };
  trangThaiFilter.onchange = () => {
    st.page = 1;
    fetchList();
  };

  // Pagination
  prevBtn.onclick = () => {
    if (st.page > 1) {
      st.page--;
      fetchList();
    }
  };
  nextBtn.onclick = () => {
    st.page++;
    fetchList();
  };
}

function setupFilters() {
  // ⭐ FIX: Thêm kiểm tra null an toàn (?. ) vào tất cả các phần tử
  $('#tp-thang')?.addEventListener('change', (e) => {
    st.filters.thang = e.target.value;
    fetchList();
  });

  $('#tp-nam')?.addEventListener('change', (e) => {
    st.filters.nam = e.target.value;
    fetchList();
  });

  $('#tp-phong-ban')?.addEventListener('change', (e) => {
    st.filters.phong_ban_id = e.target.value;
    fetchList();
  });

  $('#btn-filter-nv')?.addEventListener('click', () => {
    st.filters.nhan_vien_id = st.selectedNhanVienId || '';
    fetchList();
  });

  $('#btn-export-tp')?.addEventListener('click', exportExcel);
}

// ================== INIT ==================
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('y').textContent = new Date().getFullYear();

  requireAuthOrRedirect('./dang-nhap.html');

  if (!canManage()) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-danger">Bạn không có quyền xem trang này.</td></tr>`;
    return;
  }

  await loadChucVu();
  st.page = 1;
  await fetchList();
  bind();
});
