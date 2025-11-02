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
  roles: null,
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
  const u = getUser();
  const b = $('#user-badge');
  if (!b) return;
  if (!u) {
    b.className = 'badge badge-warn';
    b.textContent = 'Chưa đăng nhập';
    return;
  }
  const role = u.role ?? u.quyen ?? 'employee';
  b.className = 'badge badge-ok';
  b.textContent = `User: ${u.username ?? u.ten_dang_nhap ?? ''} • ${role}`;
  st.roles = role;
  if (role !== 'admin' && role !== 'manager')
    $('#nv-btn-create').style.display = 'none';
}

function rowHtml(x) {
  return `<tr data-id="${x.id}">
    <td>${x.id}</td>
    <td>${esc(x.ho_ten)}</td>
    <td>${esc(x.gioi_tinh || '')}</td>
    <td>${esc(x.ten_phong_ban || '')}</td>
    <td>${esc(x.ten_chuc_vu || '')}</td>
    <td>${esc(x.email || '')}</td>
    <td>${esc(x.so_dien_thoai || '')}</td>
    <td>${
      x.ngay_vao_lam ? new Date(x.ngay_vao_lam).toLocaleDateString('vi-VN') : ''
    }</td>
    <td>${esc(x.trang_thai || '')}</td>
    <td>
      <button class="page-btn" data-act="edit">Sửa</button>
      <button class="page-btn" data-act="del">Xoá</button>
    </td>
  </tr>`;
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
  const d = res?.data ?? res;
  st.list = d.items ?? [];
  st.total = d.total ?? st.list.length;

  $('#nv-tbody').innerHTML = st.list.length
    ? st.list.map(rowHtml).join('')
    : `<tr><td colspan="10" class="text-muted">Không có dữ liệu</td></tr>`;
  renderPaging();
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

function openModal(edit = null) {
  st.editingId = edit?.id ?? null;
  $('#nv-modal-title').textContent = edit
    ? `Sửa nhân viên #${edit.id}`
    : 'Thêm nhân viên';
  $('#nv-ho_ten').value = edit?.ho_ten ?? '';
  $('#nv-gioi_tinh').value = edit?.gioi_tinh ?? 'Nam';
  $('#nv-ngay_sinh').value = edit?.ngay_sinh ?? '';
  $('#nv-email').value = edit?.email ?? '';
  $('#nv-so_dien_thoai').value = edit?.so_dien_thoai ?? '';
  $('#nv-dia_chi').value = edit?.dia_chi ?? '';
  $('#nv-phong_ban_id').value = edit?.phong_ban_id ?? '';
  $('#nv-trang_thai').value = edit?.trang_thai ?? 'dang_lam';
  $('#nv-ghi_chu').value = edit?.ghi_chu ?? '';
  $('#nv-error').hidden = true;

  // khi mở modal, tải lại chức vụ theo phòng ban hiện tại
  const phongBanId = edit?.phong_ban_id ?? '';
  loadChucVus(phongBanId).then(() => {
    $('#nv-chuc_vu_id').value = edit?.chuc_vu_id ?? '';
  });

  $('#nv-modal').showModal();
}

function closeModal() {
  $('#nv-modal').close();
}

function canEditOrDelete() {
  return st.roles === 'admin' || st.roles === 'manager';
}

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
  $('#nv-btn-create').addEventListener('click', () =>
    canEditOrDelete()
      ? openModal(null)
      : alert('Bạn không có quyền tạo nhân viên')
  );

  $('#nv-cancel').addEventListener('click', closeModal);

  $('#nv-form').addEventListener('submit', async (e) => {
    e.preventDefault();
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

    if (act === 'edit') {
      if (!canEditOrDelete()) return alert('Bạn không có quyền');
      openModal(item);
    }
    if (act === 'del') {
      if (!canEditOrDelete()) return alert('Bạn không có quyền');
      if (!confirm(`Xoá nhân viên #${id}?`)) return;
      await api(`/nhan-vien/${id}`, { method: 'DELETE' });
      await fetchList();
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
  const yearEl = document.getElementById('y');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  setUserBadge();
  await loadPhongBans();
  await loadChucVus();
  await fetchList();
  bind();
}
document.addEventListener('DOMContentLoaded', init);
