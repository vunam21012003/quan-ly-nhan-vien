import {
  api,
  getUser,
  getToken,
  clearAuth,
  requireAuthOrRedirect,
} from './api.js';

const st = {
  page: 1,
  limit: 10,
  total: 0,
  items: [],
  editingId: null,
  filtered: false,
};

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) =>
  (s ?? '').toString().replace(/[&<>"']/g, (m) => {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }[m];
  });
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
  const u = getUser();
  if (!u) return;
  const role = u.role ?? u.quyen ?? 'user';
  if (role === 'employee') $('#btn-create').style.display = 'none';
}

function pageInfo() {
  const totalPages = Math.max(1, Math.ceil(st.total / st.limit));
  $('#pageInfo').textContent = `Trang ${st.page}/${totalPages}`;
  $('#prev').disabled = st.page <= 1;
  $('#next').disabled = st.page >= totalPages;
}

function rowHtml(x) {
  const nv = x.ho_ten ? `${x.ho_ten} ` : x.nhan_vien_id || '';
  return `<tr>
    <td>${esc(x.nhan_vien_id)}</td>
    <td>${esc(nv)}</td>
    <td>${esc(fmtDate(x.ngay_lam))}</td>
    <td>${esc(fmtTime(x.gio_vao) || '')}</td>
    <td>${esc(fmtTime(x.gio_ra) || '')}</td>
    <td>${esc(x.trang_thai || '')}</td>
    <td>${esc(x.ghi_chu || '')}</td>
    <td>
      <button class="page-btn" data-act="edit" data-id="${x.id}">Sửa</button>
      <button class="page-btn" data-act="del"  data-id="${x.id}">Xoá</button>
    </td>
  </tr>`;
}

// ================== LẤY DANH SÁCH ==================
async function fetchList(params = {}) {
  const qs = new URLSearchParams({
    page: String(st.page),
    limit: String(st.limit),
  });

  // Nếu có tham số lọc cụ thể thì thêm vào
  if (params.nhan_vien_id) qs.set('nhan_vien_id', params.nhan_vien_id);
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);

  const resp = await api(`/cham-cong?${qs}`).catch(() => ({ data: [] }));
  const { items, total } = unwrap(resp);
  st.items = items;
  st.total = total || items.length;

  $('#tbody').innerHTML = items.length
    ? items.map(rowHtml).join('')
    : `<tr><td colspan="9" class="text-muted">Không có dữ liệu phù hợp</td></tr>`;

  pageInfo();
}

function openModal(row = null) {
  st.editingId = row?.id ?? null;
  $('#modal-title').textContent = row
    ? `Sửa chấm công #${row.id}`
    : 'Thêm chấm công';
  $('#m-nvId').value = row?.nhan_vien_id ?? '';
  $('#m-ngay').value = row?.ngay_lam ? fmtDate(row.ngay_lam) : '';
  $('#m-in').value = row?.gio_vao ? fmtTime(row.gio_vao) : '';
  $('#m-out').value = row?.gio_ra ? fmtTime(row.gio_ra) : '';
  $('#m-note').value = row?.ghi_chu ?? '';
  $('#m-status').value = row?.trang_thai ?? 'di_lam';
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
    ngay_lam: $('#m-ngay').value,
    gio_vao: $('#m-in').value || null,
    gio_ra: $('#m-out').value || null,
    ghi_chu: $('#m-note').value.trim() || null,
    trang_thai: $('#m-status').value || 'di_lam',
  };
  if (!payload.nhan_vien_id || !payload.ngay_lam) {
    showErr('Vui lòng nhập Nhân viên ID và Ngày.');
    return;
  }
  try {
    if (st.editingId)
      await api(`/cham-cong/${st.editingId}`, { method: 'PUT', body: payload });
    else await api('/cham-cong', { method: 'POST', body: payload });
    closeModal();
    await showTodayOnly(); // refresh lại danh sách hôm nay
  } catch (err) {
    showErr(err?.message || 'Lưu thất bại');
  }
}

// ================== UPLOAD EXCEL ==================
async function onUploadExcel(e) {
  const file = e.target.files[0];
  if (!file) return alert('Vui lòng chọn file Excel!');

  const token = getToken();
  if (!token) return alert('Chưa đăng nhập!');

  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/cham-cong/import-excel', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const msg = await res.text();
    alert('❌ Upload thất bại: ' + msg);
  } else {
    const result = await res.json();
    alert(result.message || '✅ Upload thành công!');
    await showTodayOnly(); // Refresh danh sách hôm nay
  }
  e.target.value = ''; // reset input
}

// ================== NGÀY LỄ ==================
async function fetchNgayLe() {
  const resp = await api('/ngay-le');
  const { items } = unwrap(resp);
  $('#tbody-le').innerHTML = items.length
    ? items
        .map(
          (x) => `<tr>
          <td>${esc(fmtDate(x.ngay))}</td>
          <td>${esc(x.ten_ngay)}</td>
          <td>${esc(x.loai)}</td>
          <td>${esc(x.he_so_luong ?? '')}</td>
          <td>${esc(x.so_ngay_nghi ?? '')}</td>  
          <td><button class="page-btn" data-id="${
            x.id
          }" data-act="del-le">Xoá</button></td>
        </tr>`
        )
        .join('')
    : `<tr><td colspan="5" class="text-muted">Không có dữ liệu</td></tr>`;
}

async function addNgayLe() {
  const body = {
    ngay: $('#le-ngay').value,
    ten_ngay: $('#le-ten').value,
    loai: $('#le-loai').value,
    he_so_luong: Number($('#le-he-so').value) || 3,
    so_ngay_nghi: Number($('#le-so-ngay-nghi').value) || 1, // 👈 thêm dòng này
  };
  if (!body.ngay || !body.ten_ngay) return alert('Điền đầy đủ thông tin!');
  await api('/ngay-le', { method: 'POST', body });
  await fetchNgayLe();
  alert('✅ Đã thêm ngày lễ thành công!');
}

// ================== HIỂN THỊ CHỈ HÔM NAY ==================
async function showTodayOnly() {
  const today = new Date().toISOString().slice(0, 10);
  st.filtered = false; // chưa lọc thủ công
  await fetchList({ from: today, to: today });
}

// ================== BIND ==================
function bind() {
  $('#btn-refresh').addEventListener('click', showTodayOnly);

  $('#btn-search').addEventListener('click', () => {
    const nvId = $('#nvId').value.trim();
    const nvName = $('#nvName').value.trim();
    const status = $('#statusFilter').value;
    const from = $('#from').value;
    const to = $('#to').value;

    st.page = 1;
    st.filtered = true;

    fetchList({
      nhan_vien_id: nvId || null,
      ten_nhan_vien: nvName || null,
      trang_thai: status || null,
      from: from || null,
      to: to || null,
    });
  });

  $('#btn-create').addEventListener('click', () => openModal(null));
  $('#btn-cancel').addEventListener('click', closeModal);
  $('#form').addEventListener('submit', onSave);
  $('#fileExcel').addEventListener('change', onUploadExcel);
  $('#btn-add-le').addEventListener('click', addNgayLe);

  $('#prev').addEventListener('click', () => {
    if (st.page > 1) {
      st.page--;
      if (st.filtered) {
        const nvId = $('#nvId').value.trim();
        const from = $('#from').value;
        const to = $('#to').value;
        fetchList({ nhan_vien_id: nvId, from, to });
      } else showTodayOnly();
    }
  });

  $('#next').addEventListener('click', () => {
    st.page++;
    if (st.filtered) {
      const nvId = $('#nvId').value.trim();
      const from = $('#from').value;
      const to = $('#to').value;
      fetchList({ nhan_vien_id: nvId, from, to });
    } else showTodayOnly();
  });

  $('#tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.act;
    const row = st.items.find((x) => String(x.id) === String(id));
    if (act === 'edit') openModal(row);
    if (act === 'del') {
      if (!confirm(`Xoá chấm công #${id}?`)) return;
      await api(`/cham-cong/${id}`, { method: 'DELETE' });
      await showTodayOnly();
    }
  });

  $('#tbody-le').addEventListener('click', async (e) => {
    const btn = e.target.closest("button[data-act='del-le']");
    if (!btn) return;
    const id = btn.dataset.id;
    if (!confirm('Xoá ngày lễ này?')) return;
    await api(`/ngay-le/${id}`, { method: 'DELETE' });
    await fetchNgayLe();
  });

  $('#logout-btn')?.addEventListener('click', () => {
    clearAuth();
    location.href = './dang-nhap.html';
  });
}

// ================== INIT ==================
async function init() {
  requireAuthOrRedirect('./dang-nhap.html');
  if (!getToken()) return;
  setUserBadge();

  await fetchNgayLe();
  await showTodayOnly(); // 🔹 chỉ hiển thị chấm công hôm nay
  bind();
}
document.addEventListener('DOMContentLoaded', init);
