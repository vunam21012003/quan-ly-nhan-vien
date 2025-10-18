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

function setUserBadge() {
  const b = $('#user-badge'),
    u = getUser();
  if (!b) return;
  if (!u) {
    b.className = 'badge badge-warn';
    b.textContent = 'Chưa đăng nhập';
    return;
  }
  const role = u.role ?? u.quyen ?? 'user';
  b.className = 'badge badge-ok';
  b.textContent = `User: ${u.username ?? u.ten_dang_nhap ?? ''} • ${role}`;
  if (role !== 'admin') {
    $('#pb-btn-create').style.display = 'none';
  }
}

function unwrap(r) {
  const d = r?.data ?? r;
  if (Array.isArray(d)) return { items: d, total: d.length };
  if (d?.items) return { items: d.items, total: d.total ?? d.items.length };
  return { items: d?.list ?? [], total: d?.total ?? 0 };
}

function rowHtml(x) {
  return `<tr>
    <td>${esc(x.id)}</td>
    <td>${esc(x.ten)}</td>
    <td>${esc(x.mo_ta || '')}</td>
    <td>${esc(x.manager_name || '')}</td>
    <td>
      <button class="page-btn" data-act="edit" data-id="${x.id}">Sửa</button>
      <button class="page-btn" data-act="del"  data-id="${x.id}">Xoá</button>
    </td>
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
  const res = await api(`/phong-ban?${qs.toString()}`).catch(() => ({
    data: [],
  }));
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
    .map((x) => `<option value="${esc(x.ho_ten)}">`)
    .join('');
}

function openModal(edit = null) {
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

async function onSave(e) {
  e.preventDefault();
  const val = $('#pb-manager').value.trim();
  const idStr = val.split(' ')[0];
  const payload = {
    ten: $('#pb-ten').value.trim(),
    mo_ta: $('#pb-mo_ta').value.trim() || null,
    manager_taikhoan_id: idStr && !isNaN(idStr) ? Number(idStr) : null,
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

  $('#pb-tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
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

async function init() {
  requireAuthOrRedirect('./dangnhap.html');
  if (!getToken()) return;
  const yearEl = $('#y');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  setUserBadge();
  await loadManagers();
  await fetchList();
  bind();
}

document.addEventListener('DOMContentLoaded', init);
