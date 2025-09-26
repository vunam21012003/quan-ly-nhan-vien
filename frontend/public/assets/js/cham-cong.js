import {
  api,
  getUser,
  getToken,
  clearAuth,
  requireAuthOrRedirect,
} from './api.js';
const st = { page: 1, limit: 10, total: 0, items: [], editingId: null };

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
const fmtDate = (s) => (s ? ('' + s).slice(0, 10) : '');
const fmtTime = (s) => (s ? ('' + s).slice(0, 8) : '');

function unwrap(r) {
  const d = r?.data ?? r;
  if (Array.isArray(d)) return { items: d, total: d.length };
  if (d?.items) return { items: d.items, total: d.total ?? d.items.length };
  if (d?.rows) return { items: d.rows, total: d.total ?? d.rows.length };
  return { items: d?.list ?? [], total: d?.total ?? 0 };
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
  if (role === 'employee' || role === 'nhanvien') {
    $('#btn-create').style.display = 'none';
  }
}
function pageInfo() {
  const totalPages = Math.max(1, Math.ceil(st.total / st.limit));
  $('#pageInfo').textContent = `Trang ${st.page}/${totalPages}`;
  $('#prev').disabled = st.page <= 1;
  $('#next').disabled = st.page >= totalPages;
}

function rowHtml(x) {
  const nv = x.nhan_vien?.ho_ten
    ? `${x.nhan_vien.ho_ten} (#${x.nhan_vien_id})`
    : x.nhan_vien_id || '';
  return `<tr>
    <td>${esc(x.id)}</td>
    <td>${esc(nv)}</td>
    <td>${esc(fmtDate(x.ngay))}</td>
    <td>${esc(fmtTime(x.check_in) || '')}</td>
    <td>${esc(fmtTime(x.check_out) || '')}</td>
    <td>${esc(x.ghi_chu || '')}</td>
    <td>
      <button class="page-btn" data-act="edit" data-id="${x.id}">Sửa</button>
      <button class="page-btn" data-act="del"  data-id="${x.id}">Xoá</button>
    </td>
  </tr>`;
}

async function fetchList() {
  const qs = new URLSearchParams({
    page: String(st.page),
    limit: String(st.limit),
  });
  const nvId = $('#nvId').value.trim();
  if (nvId) qs.set('nhan_vien_id', nvId);
  const from = $('#from').value;
  if (from) qs.set('from', from);
  const to = $('#to').value;
  if (to) qs.set('to', to);
  const resp = await api(`/cham-cong?${qs}`).catch(() => ({ data: [] }));
  const { items, total } = unwrap(resp);
  st.items = items;
  st.total = total || items.length;
  const tbody = $('#tbody');
  tbody.innerHTML = items.length
    ? items.map(rowHtml).join('')
    : `<tr><td colspan="7" class="text-muted">Không có dữ liệu</td></tr>`;
  pageInfo();
}

function openModal(row = null) {
  st.editingId = row?.id ?? null;
  $('#modal-title').textContent = row
    ? `Sửa chấm công #${row.id}`
    : 'Thêm chấm công';
  $('#m-nvId').value = row?.nhan_vien_id ?? '';
  $('#m-ngay').value = row?.ngay ? fmtDate(row.ngay) : '';
  $('#m-in').value = row?.check_in ? fmtTime(row.check_in) : '';
  $('#m-out').value = row?.check_out ? fmtTime(row.check_out) : '';
  $('#m-note').value = row?.ghi_chu ?? '';
  $('#modal-error').hidden = true;
  $('#modal').showModal();
}
function closeModal() {
  $('#modal').close();
}
function showErr(msg) {
  const el = $('#modal-error');
  el.hidden = false;
  el.textContent = msg;
}

async function onSave(e) {
  e.preventDefault();
  const payload = {
    nhan_vien_id: Number($('#m-nvId').value),
    ngay: $('#m-ngay').value,
    check_in: $('#m-in').value || null,
    check_out: $('#m-out').value || null,
    ghi_chu: $('#m-note').value.trim() || null,
  };
  if (!payload.nhan_vien_id || !payload.ngay) {
    showErr('Vui lòng nhập Nhân viên ID và Ngày.');
    return;
  }
  try {
    if (st.editingId)
      await api(`/cham-cong/${st.editingId}`, { method: 'PUT', body: payload });
    else await api('/cham-cong', { method: 'POST', body: payload });
    closeModal();
    await fetchList();
  } catch (err) {
    showErr(err?.message || 'Lưu thất bại');
  }
}

function bind() {
  $('#btn-refresh').addEventListener('click', () =>
    fetchList().catch(() => {})
  );
  $('#btn-search').addEventListener('click', () => {
    st.page = 1;
    fetchList().catch(() => {});
  });
  $('#btn-create').addEventListener('click', () => openModal(null));
  $('#btn-cancel').addEventListener('click', closeModal);
  $('#form').addEventListener('submit', onSave);
  $('#prev').addEventListener('click', () => {
    if (st.page > 1) {
      st.page--;
      fetchList().catch(() => {});
    }
  });
  $('#next').addEventListener('click', () => {
    st.page++;
    fetchList().catch(() => {});
  });
  $('#tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.act;
    const row = st.items.find((x) => String(x.id) === String(id));
    if (act === 'edit') {
      openModal(row);
    }
    if (act === 'del') {
      if (!confirm(`Xoá chấm công #${id}?`)) return;
      try {
        await api(`/cham-cong/${id}`, { method: 'DELETE' });
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

async function init() {
  requireAuthOrRedirect('./dangnhap.html');
  if (!getToken()) return;
  $('#y').textContent = new Date().getFullYear();
  setUserBadge();
  await fetchList();
  bind();
}
document.addEventListener('DOMContentLoaded', init);
