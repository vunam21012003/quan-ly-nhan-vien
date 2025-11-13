import {
  api,
  getUser,
  getToken,
  clearAuth,
  requireAuthOrRedirect,
} from './api.js';

const st = {
  list: [],
  editingId: null,
  page: 1,
  limit: 10,
  total: 0,
  managers: [],
  // Gán State để lưu thông tin User và quyền, khắc phục lỗi ReferenceError
  USER: null,
  IS_ADMIN: false,
};

function $(s, r = document) {
  return r.querySelector(s);
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

// Hàm cập nhật huy hiệu người dùng và ẩn/hiện nút thêm
function setUserBadge() {
  const b = $('#user-badge');
  if (!b) return;

  if (!st.USER) {
    b.className = 'badge badge-warn';
    b.textContent = 'Chưa đăng nhập';
    return;
  }
  const role = st.USER.role ?? st.USER.quyen ?? 'user';
  b.className = 'badge badge-ok';
  b.textContent = `User: ${
    st.USER.username ?? st.USER.ten_dang_nhap ?? ''
  } • ${role}`;

  // Ẩn nút tạo nếu không phải Admin
  if (!st.IS_ADMIN) {
    $('#pb-btn-create').style.display = 'none';
  }
}

function unwrap(r) {
  const d = r?.data ?? r;
  if (Array.isArray(d)) return { items: d, total: d.length };
  if (d?.items) return { items: d.items, total: d.total ?? d.items.length };
  return { items: d?.list ?? [], total: d?.total ?? 0 };
}

// Hàm tạo HTML cho mỗi dòng, ẩn nút Thao tác nếu không phải Admin
function rowHtml(x) {
  const actionButtons = st.IS_ADMIN
    ? `<td>
          <button class="page-btn" data-act="edit" data-id="${x.id}">Sửa</button>
          <button class="page-btn" data-act="del"  data-id="${x.id}">Xoá</button>
      </td>`
    : `<td>—</td>`; // Nếu không phải Admin thì ẩn nút thao tác

  return `<tr>
        <td>${esc(x.id)}</td>
        <td>${esc(x.ten)}</td>
        <td>${esc(x.mo_ta || '')}</td>
        <td>${esc(x.manager_name || '')}</td>
        ${actionButtons}
    </tr>`;
}

function renderPagination() {
  const totalPages = Math.ceil(st.total / st.limit);
  const container = $('#pb-pagination');
  if (!container) return;

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '';
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn ${
      i === st.page ? 'btn-primary' : ''
    }" data-page="${i}">${i}</button>`;
  }
  container.innerHTML = html;

  container.querySelectorAll('button[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      st.page = Number(btn.dataset.page);
      fetchList();
    });
  });
}

async function fetchList() {
  const s = $('#pb-search').value.trim();
  const qs = new URLSearchParams({
    page: String(st.page),
    limit: String(st.limit),
  });
  if (s) qs.set('search', s);
  const res = await api(`/phong-ban?${qs.toString()}`).catch((e) => {
    console.error('Lỗi khi tải danh sách:', e);
    // Xử lý khi Backend trả về lỗi 403 (Không có quyền)
    if (e.status === 403) {
      $(
        '#pb-tbody'
      ).innerHTML = `<tr><td colspan="5" class="text-danger">Bạn không có quyền xem danh sách này. (Lỗi 403)</td></tr>`;
    }
    return { data: [] };
  });

  const { items, total } = unwrap(res);
  st.list = items;
  st.total = total || items.length;
  const tbody = $('#pb-tbody');
  tbody.innerHTML = items.length
    ? items.map(rowHtml).join('')
    : `<tr><td colspan="5" class="text-muted">Không có dữ liệu</td></tr>`;

  renderPagination();
}

async function loadManagers() {
  const res = await api('/nhan-vien?limit=500').catch(() => ({ data: [] }));
  const { items } = unwrap(res);
  st.managers = items;
  const list = document.getElementById('pb-manager-list');
  list.innerHTML = items
    .map((x) => `<option value="${esc(x.id)} - ${esc(x.ho_ten)}">`)
    .join('');
}

// Ngăn chặn mở Modal nếu không phải Admin
function openModal(edit = null) {
  if (!st.IS_ADMIN) return; // Chỉ Admin mới được mở modal Thêm/Sửa

  st.editingId = edit?.id ?? null;
  $('#pb-modal-title').textContent = edit
    ? `Sửa phòng ban #${edit.id}`
    : 'Thêm phòng ban';
  $('#pb-ten').value = edit?.ten ?? '';
  $('#pb-mo_ta').value = edit?.mo_ta ?? '';
  $('#pb-error').hidden = true;

  if (edit?.manager_taikhoan_id) {
    const manager = st.managers.find(
      (m) => String(m.id) === String(edit.manager_taikhoan_id)
    );
    $('#pb-manager').value = manager ? `${manager.id} - ${manager.ho_ten}` : '';
  } else {
    $('#pb-manager').value = '';
  }

  $('#pb-modal').showModal();
}

function closeModal() {
  $('#pb-modal').close();
}
function showErr(m) {
  const el = $('#pb-error');
  el.hidden = false;
  el.textContent = m;
}

// Kiểm tra quyền Admin trước khi gửi request C/U
async function onSave(e) {
  e.preventDefault();
  if (!st.IS_ADMIN) {
    showErr('Bạn không có quyền thực hiện thao tác này.');
    return;
  }

  const val = $('#pb-manager').value.trim();
  // Lấy ID từ chuỗi: "ID - Tên"
  const idStr = val.split(' ')[0];
  const payload = {
    ten: $('#pb-ten').value.trim(),
    mo_ta: $('#pb-mo_ta').value.trim() || null,
    // Ép kiểu ID thành số (manager_taikhoan_id)
    manager_taikhoan_id: idStr && !isNaN(Number(idStr)) ? Number(idStr) : null,
  };
  if (!payload.ten) {
    showErr('Vui lòng nhập tên');
    return;
  }
  try {
    if (st.editingId) {
      await api(`/phong-ban/${st.editingId}`, { method: 'PUT', body: payload });
    } else {
      await api('/phong-ban', { method: 'POST', body: payload });
    }
    closeModal();
    await fetchList();
  } catch (err) {
    showErr(err?.message || 'Lưu thất bại');
  }
}

function bind() {
  // Nút tải lại
  $('#pb-btn-refresh').addEventListener('click', () => {
    st.page = 1;
    $('#pb-search').value = '';
    fetchList().catch(() => {});
  });

  // Nút tìm kiếm
  $('#pb-btn-search').addEventListener('click', () => {
    st.page = 1;
    fetchList().catch(() => {});
  });

  $('#pb-btn-create').addEventListener('click', () => openModal(null));
  $('#pb-cancel').addEventListener('click', closeModal);
  $('#pb-form').addEventListener('submit', onSave);

  // Kiểm tra quyền Admin trước khi thực hiện Sửa/Xóa
  $('#pb-tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;

    if (!st.IS_ADMIN) return; // Chỉ Admin mới được thao tác Sửa/Xóa

    const id = btn.dataset.id;
    const act = btn.dataset.act;
    const row = st.list.find((x) => String(x.id) === String(id));

    if (act === 'edit') openModal(row);

    if (act === 'del') {
      if (!confirm(`Xoá phòng ban #${id}?`)) return;
      try {
        await api(`/phong-ban/${id}`, { method: 'DELETE' });
        await fetchList();
      } catch (err) {
        alert(err?.message || 'Không thể xoá');
      }
    }
  });

  // ✅ Đăng xuất
  $('#logout-btn').addEventListener('click', () => {
    clearAuth();
    location.href = './dangnhap.html';
  });
}

// Gán st.USER và st.IS_ADMIN ở đây để tránh lỗi ReferenceError
async function init() {
  requireAuthOrRedirect('./dangnhap.html');
  if (!getToken()) return;

  // Gán USER và IS_ADMIN sau khi xác thực
  st.USER = getUser();
  const currentRole = st.USER?.role ?? st.USER?.quyen;
  st.IS_ADMIN = currentRole === 'admin';

  const yearEl = $('#y');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  setUserBadge();
  await loadManagers();
  await fetchList();
  bind();
}

document.addEventListener('DOMContentLoaded', init);
