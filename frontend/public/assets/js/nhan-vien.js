import {
  API_BASE,
  api,
  getUser,
  getToken,
  clearAuth,
  requireAuthOrRedirect,
} from './api.js';

const state = {
  page: 1,
  limit: 10,
  total: 0,
  items: [],
  editingId: null,
  lookups: { phong_ban: [], chuc_vu: [] },
};

function $(sel, root = document) {
  return root.querySelector(sel);
}
function esc(s) {
  return (s ?? '').toString().replace(/[&<>"']/g, (m) => {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }[m];
  });
}

// ========== Thông tin người dùng ==========
function setUserBadge() {
  const badge = $('#user-badge');
  const u = getUser();
  if (!badge) return;
  if (!u) {
    badge.className = 'badge badge-warn';
    badge.textContent = 'Chưa đăng nhập';
    return;
  }
  const role = u.role ?? u.quyen ?? 'user';
  badge.className = 'badge badge-ok';
  badge.textContent = `User: ${u.username ?? u.ten_dang_nhap ?? ''} • ${role}`;
  if (role === 'employee' || role === 'nhanvien') {
    const btn = $('#btn-create');
    if (btn) btn.style.display = 'none';
  }
}

// ========== Phân trang ==========
function applyPageInfo() {
  const totalPages = Math.max(1, Math.ceil(state.total / state.limit));
  $('#pageInfo').textContent = `Trang ${state.page}/${totalPages}`;
  $('#prev').disabled = state.page <= 1;
  $('#next').disabled = state.page >= totalPages;
}

// ========== Render từng dòng ==========
function rowHtml(x) {
  const heSo =
    x.he_so_luong != null && !isNaN(Number(x.he_so_luong))
      ? Number(x.he_so_luong).toFixed(2)
      : '';
  return `<tr>
    <td>${esc(x.id)}</td>
    <td>${esc(x.ho_ten)}</td>
    <td>${esc(x.email)}</td>
    <td>${esc(x.gioi_tinh || '')}</td>
    <td>${esc(x.ten_phong_ban || x.phong_ban_id || '')}</td>
    <td>${esc(x.ten_chuc_vu || x.chuc_vu_id || '')}</td>
    <td>${esc(heSo)}</td>
    <td>${esc(x.trang_thai || '')}</td>
    <td>
      <button class="page-btn" data-action="edit" data-id="${x.id}">Sửa</button>
      <button class="page-btn" data-action="del" data-id="${x.id}">Xoá</button>
    </td>
  </tr>`;
}

// ========== Chuẩn hoá dữ liệu từ API ==========
function unwrap(resp) {
  const d = resp?.data ?? resp;
  if (Array.isArray(d)) return { items: d, total: d.length };
  if (d?.items) return { items: d.items, total: d.total ?? d.items.length };
  if (d?.rows) return { items: d.rows, total: d.total ?? d.rows.length };
  return { items: d?.list ?? [], total: d?.total ?? 0 };
}

// ========== Load danh mục phòng ban / chức vụ ==========
async function loadLookups() {
  try {
    const [pb, cv] = await Promise.all([
      api('/phong-ban').catch(() => ({ data: [] })),
      api('/chuc-vu').catch(() => ({ data: [] })),
    ]);
    state.lookups.phong_ban = unwrap(pb).items;
    state.lookups.chuc_vu = unwrap(cv).items;

    const selPB = $('#phong_ban_id'),
      selCV = $('#chuc_vu_id');
    if (selPB) {
      selPB.innerHTML =
        '<option value="">-- Chọn --</option>' +
        state.lookups.phong_ban
          .map((x) => `<option value="${x.id}">${esc(x.ten)}</option>`)
          .join('');
    }
    if (selCV) {
      selCV.innerHTML =
        '<option value="">-- Chọn --</option>' +
        state.lookups.chuc_vu
          .map((x) => `<option value="${x.id}">${esc(x.ten_chuc_vu)}</option>`)
          .join('');
    }
  } catch (err) {
    console.error('Load lookup lỗi:', err);
  }
}

// ========== Lấy danh sách nhân viên ==========
async function fetchList() {
  const q = new URLSearchParams({
    page: String(state.page),
    limit: String(state.limit),
  });
  const search = $('#search').value.trim();
  if (search) q.set('search', search);

  // ⚙️ Trim URL để tránh lỗi /nhan-vien%0A
  const resp = await api(`/nhan-vien?${q.toString().trim()}`);
  const { items, total } = unwrap(resp);
  state.items = items || [];
  state.total = total || state.items.length;

  const tbody = $('#tbody');
  if (!state.items.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-muted">Không có dữ liệu</td></tr>`;
  } else {
    tbody.innerHTML = state.items.map(rowHtml).join('');
  }
  applyPageInfo();
}

// ========== Form thêm/sửa ==========
function openModal(editing = null) {
  state.editingId = editing?.id ?? null;
  $('#modal-title').textContent = editing
    ? `Sửa nhân viên #${editing.id}`
    : 'Thêm nhân viên';
  $('#modal-error').hidden = true;
  $('#ho_ten').value = editing?.ho_ten ?? '';
  $('#email').value = editing?.email ?? '';
  $('#so_dien_thoai').value = editing?.so_dien_thoai ?? '';
  $('#gioi_tinh').value = editing?.gioi_tinh ?? '';
  $('#phong_ban_id').value = editing?.phong_ban_id ?? '';
  $('#chuc_vu_id').value = editing?.chuc_vu_id ?? '';
  $('#ngay_vao_lam').value = editing?.ngay_vao_lam ?? '';
  $('#he_so_luong').value = editing?.he_so_luong ?? 1.0;
  $('#trang_thai').value = editing?.trang_thai ?? 'dang_lam';
  $('#modal').showModal();
}
function closeModal() {
  $('#modal').close();
}

// ========== Lưu nhân viên ==========
async function onSave(e) {
  e.preventDefault();
  $('#modal-error').hidden = true;

  const payload = {
    ho_ten: $('#ho_ten').value.trim(),
    email: $('#email').value.trim() || null,
    so_dien_thoai: $('#so_dien_thoai').value.trim() || null,
    gioi_tinh: $('#gioi_tinh').value || null,
    phong_ban_id: $('#phong_ban_id').value || null,
    chuc_vu_id: $('#chuc_vu_id').value || null,
    ngay_vao_lam: $('#ngay_vao_lam').value || null,
    he_so_luong: parseFloat($('#he_so_luong').value) || 1.0,
    trang_thai: $('#trang_thai').value || 'dang_lam',
  };
  if (!payload.ho_ten) {
    showModalError('Vui lòng nhập họ tên.');
    return;
  }

  try {
    if (state.editingId) {
      await api(`/nhan-vien/${state.editingId}`, {
        method: 'PUT',
        body: payload,
      });
    } else {
      await api('/nhan-vien', { method: 'POST', body: payload });
    }
    closeModal();
    await fetchList();
  } catch (err) {
    showModalError(err?.message || 'Lưu thất bại');
  }
}
function showModalError(msg) {
  const el = $('#modal-error');
  el.hidden = false;
  el.textContent = msg;
}

// ========== Gắn sự kiện ==========
function bindEvents() {
  $('#btn-refresh').addEventListener('click', () =>
    fetchList().catch(() => {})
  );
  $('#btn-search').addEventListener('click', () => {
    state.page = 1;
    fetchList().catch(() => {});
  });
  $('#btn-create').addEventListener('click', () => openModal(null));
  $('#btn-cancel').addEventListener('click', closeModal);
  $('#form').addEventListener('submit', onSave);
  $('#prev').addEventListener('click', () => {
    if (state.page > 1) {
      state.page--;
      fetchList().catch(() => {});
    }
  });
  $('#next').addEventListener('click', () => {
    state.page++;
    fetchList().catch(() => {});
  });

  $('#tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;

    const row = state.items.find((x) => String(x.id) === String(id));

    if (action === 'edit') {
      let detail = row;
      try {
        const resp = await api(`/nhan-vien/${id}`);
        detail = (resp?.data ?? resp) || row;
      } catch {}
      openModal(detail);
    }

    if (action === 'del') {
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
    location.href = './dang-nhap.html';
  });
}

// ========== Khởi tạo ==========
async function init() {
  requireAuthOrRedirect('./dang-nhap.html');
  if (!getToken()) return;
  $('#y').textContent = new Date().getFullYear();
  setUserBadge();
  await loadLookups();
  await fetchList();
  bindEvents();
}
document.addEventListener('DOMContentLoaded', init);
