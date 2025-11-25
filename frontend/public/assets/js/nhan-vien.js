// nhan-vien.js
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

/* ==========================================================
   HELPER NHẬN DIỆN MANAGER KẾ TOÁN
========================================================== */
function isAccountingManagerFE() {
  if (!st.USER || st.ROLE !== 'manager') return false;

  const dep =
    st.USER.ten_phong_ban || st.USER.department || st.USER.phong_ban_ten || '';

  const lower = dep.toLowerCase();
  return lower.includes('kế toán') || lower.includes('ke toan');
}

function toInputDate(d) {
  if (!d) return '';

  // ISO: 2025-01-15T00:00:00Z
  if (d.includes('T')) return d.split('T')[0];

  // SQL: 2025-01-15 00:00:00
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.split(' ')[0];

  // Việt Nam: 15/09/1989
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
    const [dd, mm, yyyy] = d.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }

  return '';
}

/* ==========================================================
   HIỂN THỊ USER
========================================================== */
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

  if (!st.IS_MANAGER_OR_ADMIN) {
    $('#nv-btn-create').style.display = 'none';
  }
}

/* ==========================================================
   HTML ROW
========================================================== */
function rowHtml(x) {
  const myRole = st.ROLE;
  const myPB = st.USER?.phong_ban_id || null;
  const empPB = x.phong_ban_id || null;

  const isManagerKT = isAccountingManagerFE(); // FE nhận diện phòng kế toán

  let canEdit = false;

  // ===========================
  //   🔥 QUYỀN EDIT CHUẨN
  // ===========================

  if (myRole === 'admin') {
    canEdit = true;
  } else if (myRole === 'manager') {
    // Manager KẾ TOÁN → chỉ sửa NV phòng Kế toán
    if (isManagerKT) {
      const pbName = (x.ten_phong_ban || '').toLowerCase();
      canEdit = pbName.includes('kế toán') || pbName.includes('ke toan');
    }

    // Manager THƯỜNG → sửa NV cùng phòng ban
    else if (myPB && empPB && myPB === empPB) {
      canEdit = true;
    }
  }

  // Employee → không edit
  else {
    canEdit = false;
  }

  // ===========================
  //   RENDER BUTTONS
  // ===========================

  let actionButtons = `
      <button class="page-btn btn-sm" data-act="view">Xem</button>
  `;

  if (canEdit) {
    actionButtons += `
      <button class="page-btn btn-sm" data-act="edit">Sửa</button>
    `;
  } else {
    actionButtons += `<span class="text-muted"></span>`;
  }

  if (myRole === 'admin') {
    actionButtons += `
      <button class="page-btn btn-sm" data-act="del">Xóa</button>
    `;
  }

  return `<tr data-id="${x.id}">
    <td>${x.id}</td>
    <td>
      <img src="${x.anh_dai_dien || './assets/img/no-avatar.png'}"
           style="width:32px;height:32px;border-radius:4px;margin-right:4px;vertical-align:middle">
      ${esc(x.ho_ten)}
    </td>
    <td>${esc(x.gioi_tinh || '')}</td>
    <td>${esc(x.ten_phong_ban || '')}</td>
    <td>${esc(x.ten_chuc_vu || '')}</td>
    <td>${esc(x.email || '')}</td>
    <td>${esc(x.so_dien_thoai || '')}</td>
    <td>${
      x.ngay_vao_lam ? new Date(x.ngay_vao_lam).toLocaleDateString('vi-VN') : ''
    }</td>
    <td>${esc(x.trang_thai || '')}</td>
    <td>${actionButtons}</td>
  </tr>`;
}

/* ==========================================================
   LOAD PHÒNG BAN  ✔ FIX CHUẨN QUYỀN
========================================================== */
async function loadPhongBans() {
  let items = [];

  // ==================== ADMIN ====================
  if (st.ROLE === 'admin') {
    const res = await api('/phong-ban?limit=500').catch(() => null);
    items =
      res?.data?.items || res?.data?.data || res?.items || res?.data || [];

    st.phongBans = items;

    $('#nv-phongban').innerHTML =
      `<option value="">-- Tất cả phòng ban --</option>` +
      items
        .map((x) => `<option value="${x.id}">${esc(x.ten_phong_ban)}</option>`)
        .join('');

    $('#nv-phong_ban_id').innerHTML =
      `<option value="">-- Chọn phòng ban --</option>` +
      items
        .map((x) => `<option value="${x.id}">${esc(x.ten_phong_ban)}</option>`)
        .join('');

    return;
  }

  // ==================== MANAGER ====================
  if (st.ROLE === 'manager') {
    // ⭐ Manager phòng kế toán → load ALL phòng ban
    if (isAccountingManagerFE()) {
      const res = await api('/phong-ban?limit=500').catch(() => null);
      items = res?.data?.items || res?.data || [];

      st.phongBans = items;

      $('#nv-phongban').innerHTML =
        `<option value="">-- Tất cả phòng ban --</option>` +
        items
          .map(
            (x) => `<option value="${x.id}">${esc(x.ten_phong_ban)}</option>`
          )
          .join('');

      $('#nv-phong_ban_id').innerHTML =
        `<option value="">-- Chọn phòng ban --</option>` +
        items
          .map(
            (x) => `<option value="${x.id}">${esc(x.ten_phong_ban)}</option>`
          )
          .join('');

      // ⭐ Quan trọng: Ép dropdown về rỗng để BE trả về full
      $('#nv-phongban').value = '';

      return;
    }

    // ⭐ Manager thường → giữ logic cũ
    const me = st.USER;
    const meNV = st.list?.find((x) => x.id === me.nhan_vien_id);

    let pbId = meNV?.phong_ban_id;
    let pbName = meNV?.ten_phong_ban;

    if (!pbId) {
      const resMe = await api(`/nhan-vien/${me.nhan_vien_id}`);
      pbId = resMe?.data?.phong_ban_id;
      pbName = resMe?.data?.ten_phong_ban;
    }

    st.phongBans = [{ id: pbId, ten_phong_ban: pbName }];

    $('#nv-phongban').innerHTML = `<option value="${pbId}">${esc(
      pbName
    )}</option>`;

    $('#nv-phong_ban_id').innerHTML = `<option value="${pbId}">${esc(
      pbName
    )}</option>`;

    return;
  }

  // ==================== EMPLOYEE ====================
  if (st.ROLE === 'employee') {
    const pbId = st.USER.phong_ban_id;
    const pbName = st.USER.ten_phong_ban || 'Phòng ban';

    $('#nv-phongban').innerHTML = `<option value="${pbId}">${esc(
      pbName
    )}</option>`;
    $('#nv-phong_ban_id').innerHTML = `<option value="${pbId}">${esc(
      pbName
    )}</option>`;
  }
}

/* ==========================================================
   LOAD CHỨC VỤ  ✔ giữ nguyên
========================================================== */
async function loadChucVus(phongBanId = '') {
  const url = phongBanId
    ? `/chuc-vu?phong_ban_id=${phongBanId}&limit=500`
    : '/chuc-vu?limit=500';

  const res = await api(url).catch(() => ({ data: { items: [] } }));
  const items = res?.data?.items || res.items || [];
  st.chucVus = items;

  $('#nv-chucvu').innerHTML =
    `<option value="">-- Tất cả chức vụ --</option>` +
    items
      .map(
        (x) =>
          `<option value="${x.id}">${esc(x.ten_chuc_vu)} (${
            x.ten_phong_ban || ''
          })</option>`
      )
      .join('');

  $('#nv-chuc_vu_id').innerHTML =
    `<option value="">-- Chọn chức vụ --</option>` +
    items
      .map((x) => `<option value="${x.id}">${esc(x.ten_chuc_vu)}</option>`)
      .join('');
}

/* ==========================================================
   FETCH LIST
========================================================== */
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

  $('#nv-tbody').innerHTML =
    st.list.map(rowHtml).join('') ||
    `<tr><td colspan="10" class="text-muted">Không có dữ liệu</td></tr>`;

  renderPaging();

  if (st.ROLE === 'employee' && st.list.length === 1) {
    openModal(st.list[0], 'view');
  }
}

/* ==========================================================
   RENDER PAGING
========================================================== */
function renderPaging() {
  const totalPages = Math.ceil((st.total || 0) / st.limit);
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

  c.querySelectorAll('button[data-page]').forEach((btn) =>
    btn.addEventListener('click', () => {
      st.page = Number(btn.dataset.page);
      fetchList();
    })
  );
}

/* ==========================================================
   OPEN MODAL — FULL BẢN ĐÃ FIX
========================================================== */
async function openModal(item = null, mode = 'edit') {
  const isView = mode === 'view';
  st.editingId = item?.id ?? null;

  // ======= TIÊU ĐỀ =======
  $('#nv-modal-title').textContent =
    isView && item
      ? `Chi tiết nhân viên #${item.id}`
      : item
      ? `Sửa nhân viên #${item.id}`
      : 'Thêm nhân viên';

  // ======= GÁN DỮ LIỆU INPUT =======
  $('#nv-ho_ten').value = item?.ho_ten ?? '';
  $('#nv-gioi_tinh').value = item?.gioi_tinh ?? 'Nam';
  $('#nv-ngay_sinh').value = toInputDate(item?.ngay_sinh);

  $('#nv-email').value = item?.email ?? '';
  $('#nv-so_dien_thoai').value = item?.so_dien_thoai ?? '';
  $('#nv-dia_chi').value = item?.dia_chi ?? '';
  $('#nv-ngay_vao_lam').value = item?.ngay_vao_lam
    ? item.ngay_vao_lam.split('T')[0]
    : '';
  $('#nv-trang_thai').value = item?.trang_thai ?? 'dang_lam';
  $('#nv-ghi_chu').value = item?.ghi_chu ?? '';

  // ======= ẢNH XEM TRƯỚC =======
  if (item?.anh_dai_dien) {
    $('#nv-preview').src = item.anh_dai_dien;
    $('#nv-preview').style.display = 'block';
  } else {
    $('#nv-preview').style.display = 'none';
  }

  /* =======================================================
     PHÒNG BAN — FIX HIỂN THỊ ĐÚNG PB CỦA NHÂN VIÊN
  ======================================================= */
  const pbSelect = $('#nv-phong_ban_id');

  const employeePB = item?.phong_ban_id || '';
  const employeePBName = item?.ten_phong_ban || '';

  pbSelect.innerHTML = ''; // clear dropdown cũ

  // ==== ADMIN → hiển thị tất cả PB, chọn đúng PB của nhân viên
  if (st.ROLE === 'admin') {
    pbSelect.disabled = isView;

    pbSelect.innerHTML =
      `<option value="">-- Chọn phòng ban --</option>` +
      st.phongBans
        .map((x) => `<option value="${x.id}">${esc(x.ten_phong_ban)}</option>`)
        .join('');

    pbSelect.value = employeePB;
  }

  // ==== MANAGER (kế toán & thường) → chỉ xem, không sửa PB
  else if (st.ROLE === 'manager') {
    pbSelect.disabled = true;

    // Manager kế toán → thấy tất cả PB
    if (isAccountingManagerFE()) {
      pbSelect.innerHTML =
        `<option value="">-- Chọn phòng ban --</option>` +
        st.phongBans
          .map(
            (x) => `<option value="${x.id}">${esc(x.ten_phong_ban)}</option>`
          )
          .join('');
    } else {
      // Manager thường → chỉ hiển PB của nhân viên
      pbSelect.innerHTML = `<option value="${employeePB}">${esc(
        employeePBName
      )}</option>`;
    }

    pbSelect.value = employeePB;
  }

  // ==== EMPLOYEE → chỉ xem PB của họ
  else {
    pbSelect.disabled = true;
    pbSelect.innerHTML = `<option value="${employeePB}">${esc(
      employeePBName
    )}</option>`;
    pbSelect.value = employeePB;
  }

  /* =======================================================
     CHỨC VỤ — FIX LOAD XONG RỒI MỚI SET VALUE
  ======================================================= */
  const cvSelect = $('#nv-chuc_vu_id');
  const employeeCV = item?.chuc_vu_id || '';

  const usedPB = employeePB || $('#nv-phong_ban_id').value;

  await loadChucVus(usedPB);

  // Manager không được đổi chức vụ
  cvSelect.disabled = st.ROLE !== 'admin' || isView;

  cvSelect.value = employeeCV;

  /* =======================================================
     KHÓA INPUT KHI CHẾ ĐỘ VIEW
  ======================================================= */
  const allInputs = $('#nv-form').querySelectorAll('input, select, textarea');
  allInputs.forEach((input) => {
    input.readOnly = isView;
    input.disabled = isView;
  });

  // Nhưng admin & manager-kế-toán vẫn sửa được (trừ PB & CV)
  if (st.ROLE === 'admin') {
    pbSelect.disabled = false;
    cvSelect.disabled = false;
  } else if (st.ROLE === 'manager' && isAccountingManagerFE()) {
    // kế toán manager chỉ sửa nhân viên phòng kế toán
    pbSelect.disabled = true;
    cvSelect.disabled = true;
  }

  /* =======================================================
     NÚT LƯU / HỦY
  ======================================================= */
  $('#nv-save').style.display = isView ? 'none' : 'block';
  $('#nv-cancel').textContent = isView ? 'Đóng' : 'Hủy';

  $('#nv-modal').showModal();
}

/* ==========================================================
   CLOSE MODAL
========================================================== */
function closeModal() {
  $('#nv-modal').close();
}

/* ==========================================================
   BIND EVENT  ✔ giữ nguyên, chỉ sửa phần load chức vụ theo PB
========================================================== */
function bind() {
  $('#nv-btn-refresh').addEventListener('click', () => {
    st.page = 1;
    $('#nv-search').value = '';
    $('#nv-phongban').value = '';
    $('#nv-chucvu').value = '';
    fetchList();
  });

  $('#nv-btn-search').addEventListener('click', fetchList);

  $('#nv-phong_ban_id').addEventListener('change', async (e) => {
    const pbId = e.target.value;
    await loadChucVus(pbId);
    $('#nv-chuc_vu_id').value = '';
  });

  $('#nv-anh_dai_dien').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      $('#nv-preview').src = URL.createObjectURL(file);
      $('#nv-preview').style.display = 'block';
    }
  });

  $('#nv-btn-create').addEventListener('click', () =>
    st.IS_MANAGER_OR_ADMIN
      ? openModal(null, 'edit')
      : alert('Bạn không có quyền')
  );

  $('#nv-cancel').addEventListener('click', closeModal);

  /* SUBMIT */
  $('#nv-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!st.IS_MANAGER_OR_ADMIN) {
      showErr('Bạn không có quyền thực hiện thao tác này.');
      return;
    }

    const payload = {
      ho_ten: $('#nv-ho_ten').value.trim(),
      gioi_tinh: $('#nv-gioi_tinh').value,
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

    // Upload ảnh
    let anh_dai_dien_url = null;
    const file = $('#nv-anh_dai_dien').files[0];

    if (file) {
      const fd = new FormData();
      fd.append('file', file);

      const up = await fetch('http://localhost:8001/upload', {
        method: 'POST',
        body: fd,
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      })
        .then((r) => r.json())
        .catch(() => null);

      if (up?.url) anh_dai_dien_url = up.url;
    }

    if (anh_dai_dien_url) payload.anh_dai_dien = anh_dai_dien_url;

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
      fetchList();
    } catch (err) {
      showErr(err?.message || 'Lỗi lưu dữ liệu');
    }
  });

  $('#nv-tbody').addEventListener('click', async (e) => {
    const row = e.target.closest('tr[data-id]');
    if (!row) return;
    const id = row.dataset.id;
    const btn = e.target.closest('button.page-btn');
    if (!btn) return;

    const act = btn.dataset.act;
    const item = st.list.find((x) => x.id == id);

    if (act === 'view') return openModal(item, 'view');
    if (act === 'edit') {
      if (!st.IS_MANAGER_OR_ADMIN) return alert('Bạn không có quyền');
      return openModal(item, 'edit');
    }
    if (act === 'del') {
      if (!st.IS_MANAGER_OR_ADMIN) return alert('Bạn không có quyền');
      if (!confirm(`Xoá nhân viên #${id}?`)) return;

      await api(`/nhan-vien/${id}`, { method: 'DELETE' }).catch(() =>
        alert('Không thể xoá')
      );

      fetchList();
    }
  });

  $('#logout-btn').addEventListener('click', () => {
    clearAuth();
    location.href = './dang-nhap.html';
  });
}

/* ==========================================================
   ERROR
========================================================== */
function showErr(m) {
  const el = $('#nv-error');
  el.hidden = false;
  el.textContent = m;
}

/* ==========================================================
   INIT
========================================================== */
async function init() {
  requireAuthOrRedirect('./dang-nhap.html');
  if (!getToken()) return;

  // 1) Lấy user từ localStorage (tạm)
  st.USER = getUser();
  st.ROLE = (st.USER?.role ?? st.USER?.quyen ?? 'employee').toLowerCase();

  // 2) Ngay lập tức gọi /auth/me để lấy thông tin user CHUẨN TỪ BACKEND
  const me = await api('/auth/me').catch(() => null);
  if (me?.data) {
    st.USER = me.data;
    st.ROLE = (me.data.role ?? 'employee').toLowerCase();
  }

  // ⭐⭐ 3) LẤY ĐỦ THÔNG TIN NHÂN VIÊN (phòng ban, chức vụ, tên phòng ban…)
  if (st.USER?.nhan_vien_id) {
    const meNV = await api(`/nhan-vien/${st.USER.nhan_vien_id}`).catch(
      () => null
    );

    if (meNV?.data) {
      st.USER.phong_ban_id = meNV.data.phong_ban_id;
      st.USER.ten_phong_ban = meNV.data.ten_phong_ban;
      st.USER.chuc_vu_id = meNV.data.chuc_vu_id;
    }
  }

  // 4) Đặt flag quyền
  st.IS_ADMIN = st.ROLE === 'admin';
  st.IS_MANAGER_OR_ADMIN = st.IS_ADMIN || st.ROLE === 'manager';

  // 5) Set Badge user
  setUserBadge();

  // 6) LOAD dữ liệu
  await loadPhongBans();
  await loadChucVus();
  await fetchList();

  // 7) BIND sự kiện
  bind();

  // 8) Footer
  const yearEl = document.getElementById('y');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

document.addEventListener('DOMContentLoaded', init);

document.addEventListener('DOMContentLoaded', init);
