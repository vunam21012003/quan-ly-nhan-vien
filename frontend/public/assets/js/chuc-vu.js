import { api, getUser, clearAuth, requireAuthOrRedirect } from './api.js';

const st = {
  list: [],
  phongbans: [],
  editingId: null,
  page: 1,
  limit: 10,
  total: 0,
};

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) =>
  (s ?? '')
    .toString()
    .replace(
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
  const badge = $('#user-badge');
  if (!u || !badge) return;
  const role = u.role ?? u.quyen ?? 'employee';
  badge.textContent = `User: ${u.username ?? u.ten_dang_nhap ?? ''} • ${role}`;
  if (role !== 'admin') $('#cv-btn-create').style.display = 'none';
}

function rowHtml(x) {
  return `<tr data-id="${x.id}">
    <td>${esc(x.ten_chuc_vu)}</td>
    <td>${esc(x.ten_phong_ban || '')}</td>
    <td>${esc(x.mo_ta || '')}</td>
    <td>${esc(x.quyen_mac_dinh || '')}</td>
    <td>${Number(x.muc_luong_co_ban ?? 0).toLocaleString('vi-VN')}</td>
    <td>
      <button class="page-btn" data-act="edit" data-id="${x.id}">Sửa</button>
      <button class="page-btn" data-act="del" data-id="${x.id}">Xoá</button>
    </td>
  </tr>`;
}

async function fetchPhongBanList() {
  const res = await api('/phong-ban?limit=1000').catch(() => ({ data: [] }));
  const d = res?.data ?? res;
  st.phongbans = d.items ?? [];
  const sel = $('#cv-phongban');
  sel.innerHTML =
    `<option value="">-- Chọn phòng ban --</option>` +
    st.phongbans
      .map((x) => `<option value="${x.id}">${esc(x.ten)}</option>`)
      .join('');
}

async function fetchList() {
  const qs = new URLSearchParams({
    page: String(st.page),
    limit: String(st.limit),
    search: $('#cv-search').value.trim(),
  });
  const res = await api(`/chuc-vu?${qs.toString()}`).catch(() => ({
    data: { items: [], total: 0 },
  }));
  const d = res?.data ?? res;
  const items = d.items ?? [];
  st.list = items;
  st.total = d.total ?? items.length;
  $('#cv-tbody').innerHTML = items.length
    ? items.map(rowHtml).join('')
    : `<tr><td colspan="6" class="text-muted">Không có dữ liệu</td></tr>`;
}

function openModal(edit = null) {
  st.editingId = edit?.id ?? null;
  $('#cv-modal-title').textContent = edit ? 'Sửa chức vụ' : 'Thêm chức vụ';
  $('#cv-ten').value = edit?.ten_chuc_vu ?? '';
  $('#cv-quyen').value = edit?.quyen_mac_dinh ?? 'employee';
  $('#cv-luong').value = edit?.muc_luong_co_ban ?? 0;
  $('#cv-mo_ta').value = edit?.mo_ta ?? '';
  $('#cv-phongban').value = edit?.phong_ban_id ?? '';
  $('#cv-modal').showModal();
}
function closeModal() {
  $('#cv-modal').close();
}

async function onSave(e) {
  e.preventDefault();
  const payload = {
    ten_chuc_vu: $('#cv-ten').value.trim(),
    mo_ta: $('#cv-mo_ta').value.trim() || null,
    quyen_mac_dinh: $('#cv-quyen').value,
    muc_luong_co_ban: Number($('#cv-luong').value) || 0,
    phong_ban_id: $('#cv-phongban').value
      ? Number($('#cv-phongban').value)
      : null,
  };
  if (!payload.ten_chuc_vu) return alert('Vui lòng nhập tên');
  if (st.editingId)
    await api(`/chuc-vu/${st.editingId}`, { method: 'PUT', body: payload });
  else await api('/chuc-vu', { method: 'POST', body: payload });
  closeModal();
  await fetchList();
}

function bind() {
  $('#cv-btn-create').addEventListener('click', () => openModal());
  $('#cv-cancel').addEventListener('click', closeModal);
  $('#cv-form').addEventListener('submit', onSave);
  $('#cv-btn-refresh').addEventListener('click', fetchList);
  $('#cv-btn-search').addEventListener('click', fetchList);
  $('#cv-tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.act;
    if (act === 'edit') openModal(st.list.find((x) => x.id == id));
    if (act === 'del' && confirm('Xóa chức vụ này?')) {
      await api(`/chuc-vu/${id}`, { method: 'DELETE' });
      await fetchList();
    }
  });
}

async function init() {
  requireAuthOrRedirect('./dangnhap.html');
  setUserBadge();
  await fetchPhongBanList();
  await fetchList();
  bind();
}
document.addEventListener('DOMContentLoaded', init);
