import { openPhanCongModal } from './phan-cong-lam-bu.js';
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

const stLe = {
  page: 1,
  limit: 10,
  total: 0,
  items: [],
  filtered: false,
  filterParams: {},
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

  const role = (u.role || '').toLowerCase();
  const dep = (u.ten_phong_ban || '').toLowerCase();

  const isAdmin = role === 'admin';
  const isKeToanManager = role === 'manager' && dep.includes('kế toán');

  // ========== 1) Ẩn nút tạo chấm công cho employee ==========
  if (role === 'employee') {
    $('#btn-create').style.display = 'none';
    document
      .querySelectorAll('button[data-act="edit"]')
      .forEach((b) => b.remove());
    document
      .querySelectorAll('button[data-act="del"]')
      .forEach((b) => b.remove());
  }

  // ===========================
  // ẨN KHỐI THÊM NGÀY LỄ
  // Cho manager & employee
  // ===========================
  if (role === 'manager' || role === 'employee') {
    // 1) Ẩn toàn bộ khối thêm ngày lễ
    const addBlock = document.getElementById('ngay-le-add-block');
    if (addBlock) addBlock.style.display = 'none';

    // 2) Ẩn nút Thêm ngày lễ (phòng trường hợp không nằm trong block)
    const addBtn = document.getElementById('btn-add-le');
    if (addBtn) addBtn.style.display = 'none';

    // 3) Disable toàn bộ input (đề phòng người dùng CSS custom)
    ['le-ngay', 'le-ten', 'le-loai', 'le-so-ngay-nghi'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = true;
    });
  }
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
  if (params.phong_ban_id) qs.set('phong_ban_id', params.phong_ban_id);
  if (params.trang_thai) qs.set('trang_thai', params.trang_thai);

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

async function fetchPhongBan() {
  const resp = await api('/cham-cong/phong-ban/list');
  const { items } = unwrap(resp);
  const select = $('#phongBanFilter');
  select.innerHTML =
    '<option value="">-- Tất cả phòng ban --</option>' +
    items
      .map((x) => `<option value="${x.id}">${esc(x.ten_phong_ban)}</option>`)
      .join('');
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

// ================== XUẤT EXCEL ==================
$('#btn-export').addEventListener('click', async () => {
  const nvId = $('#nvId').value.trim();
  const status = $('#statusFilter').value;
  const from = $('#from').value;
  const to = $('#to').value;
  const phongBanId = $('#phongBanFilter').value;

  const qs = new URLSearchParams();
  if (nvId) qs.set('nhan_vien_id', nvId);
  if (status) qs.set('trang_thai', status);
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  if (phongBanId) qs.set('phong_ban_id', phongBanId);

  const token = getToken();
  const url = `/cham-cong/export?${qs.toString()}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const msg = await res.text();
      alert('❌ Lỗi khi xuất Excel: ' + msg);
      return;
    }

    const blob = await res.blob();
    const a = document.createElement('a');
    const downloadUrl = window.URL.createObjectURL(blob);
    a.href = downloadUrl;
    a.download = 'ChamCong.xlsx';
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
  } catch (err) {
    alert('❌ Không thể tải file Excel');
    console.error(err);
  }
});

// ================== NGÀY LỄ ==================
async function fetchNgayLe(params = {}) {
  stLe.filterParams = params;
  stLe.filtered = !!(params.ngay || params.ten || params.loai);

  const resp = await api('/ngay-le');
  const { items } = unwrap(resp);

  let data = items;

  // --- Lọc ---
  if (params.ngay) {
    data = data.filter((x) => fmtDate(x.ngay) === params.ngay);
  }
  if (params.ten) {
    const kw = params.ten.toLowerCase();
    data = data.filter((x) => (x.ten_ngay || '').toLowerCase().includes(kw));
  }
  if (params.loai) {
    data = data.filter((x) => x.loai === params.loai);
  }

  // Lưu vào state
  stLe.items = data;
  stLe.page = 1;

  // Render phân trang
  renderNgayLeTable();
}

async function addNgayLe() {
  const body = {
    ngay: $('#le-ngay').value,
    ten_ngay: $('#le-ten').value,
    loai: $('#le-loai').value,
    mo_ta: null,
    so_ngay_nghi: Number($('#le-so-ngay-nghi').value) || 1,
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

function renderNgayLeTable() {
  const start = (stLe.page - 1) * stLe.limit;
  const end = start + stLe.limit;
  const pageItems = stLe.items.slice(start, end);

  stLe.total = stLe.items.length;

  $('#tbody-le').innerHTML = pageItems.length
    ? pageItems
        .map((x) => {
          let actionsHtml = `<button class="page-btn" data-id="${x.id}" data-act="del-le">Xoá</button>`;
          if (x.loai === 'lam_bu') {
            actionsHtml += ` <button class="page-btn btn-success" data-ngay="${x.ngay}" data-act="phan-cong">Phân công</button>`;
          }
          return `<tr>
            <td>${esc(fmtDate(x.ngay))}</td>
            <td>${esc(x.ten_ngay)}</td>
            <td>${esc(x.loai)}</td>
            <td>${esc(x.so_ngay_nghi ?? '')}</td> 
            <td>${actionsHtml}</td>
          </tr>`;
        })
        .join('')
    : `<tr><td colspan="5" class="text-muted">Không có dữ liệu phù hợp</td></tr>`;

  const totalPages = Math.max(1, Math.ceil(stLe.total / stLe.limit));
  $('#le-pageInfo').textContent = `Trang ${stLe.page}/${totalPages}`;
  $('#le-prev').disabled = stLe.page <= 1;
  $('#le-next').disabled = stLe.page >= totalPages;
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
    const phongBanId = $('#phongBanFilter').value;

    st.page = 1;
    st.filtered = true;

    fetchList({
      nhan_vien_id: nvId || null,
      ten_nhan_vien: nvName || null,
      trang_thai: status || null,
      from: from || null,
      to: to || null,
      phong_ban_id: phongBanId || null,
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

  // ====== BỘ LỌC NGÀY LỄ ======
  $('#btn-filter-le').addEventListener('click', () => {
    const ngay = $('#le-filter-ngay').value || null;
    const ten = $('#le-filter-ten').value.trim() || null;
    const loai = $('#le-filter-loai').value || null;

    fetchNgayLe({
      ngay,
      ten,
      loai,
    });
  });

  // ===== PHÂN TRANG NGÀY LỄ =====
  $('#le-prev').addEventListener('click', () => {
    if (stLe.page > 1) {
      stLe.page--;
      renderNgayLeTable();
    }
  });

  $('#le-next').addEventListener('click', () => {
    const totalPages = Math.ceil(stLe.total / stLe.limit);
    if (stLe.page < totalPages) {
      stLe.page++;
      renderNgayLeTable();
    }
  });

  $('#btn-reset-le').addEventListener('click', () => {
    $('#le-filter-ngay').value = '';
    $('#le-filter-ten').value = '';
    $('#le-filter-loai').value = '';
    fetchNgayLe();
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
    const btn = e.target.closest('button[data-act]'); // Thay đổi để bắt được tất cả nút có data-act
    if (!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.act;

    if (act === 'del-le') {
      if (!confirm('Xoá ngày lễ này?')) return;
      await api(`/ngay-le/${id}`, { method: 'DELETE' });
      await fetchNgayLe();
      return;
    }

    // 💡 PHẦN CẦN THÊM: Xử lý sự kiện Phân công
    if (act === 'phan-cong') {
      const u = getUser();
      const role = u.role;
      const phongBan = (u.ten_phong_ban || '').toLowerCase();

      const isAdmin = role === 'admin';
      const isKeToan = role === 'manager' && phongBan.includes('kế toán');
      const isManager = role === 'manager';

      const ngay = btn.dataset.ngay;

      // Admin + Manager kế toán → phân công toàn bộ nhân viên
      if (isAdmin || isKeToan) {
        await openPhanCongModal(ngay, { restrictPhongBan: null });
        await fetchNgayLe();
        return;
      }

      // Manager phòng khác → CHỈ phân công nhân viên phòng ban mình
      if (isManager) {
        await openPhanCongModal(ngay, { restrictPhongBan: u.phong_ban_id });
        await fetchNgayLe();
        return;
      }

      alert('Bạn không có quyền phân công làm bù.');
      return;
    }
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

  await fetchPhongBan();
  await fetchNgayLe();
  await showTodayOnly(); // 🔹 chỉ hiển thị chấm công hôm nay
  bind();
}

// ================== TAB CHUYỂN ĐỔI ==================
document.addEventListener('DOMContentLoaded', () => {
  const buttons = document.querySelectorAll('.tab-btn');
  const sections = document.querySelectorAll('.tab-content');

  buttons.forEach((btn) =>
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      sections.forEach((s) => {
        if (s.id === 'tab-' + tab) s.hidden = false;
        else s.hidden = true;
      });
    })
  );
});

document.addEventListener('DOMContentLoaded', init);
