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
   HELPER KIỂM TRA TÊN PHÒNG BAN CÓ PHẢI KẾ TOÁN KHÔNG
========================================================== */
function isPhongKeToan(name) {
  if (!name) return false;
  const lower = name.toLowerCase();
  return lower.includes('kế toán') || lower.includes('ke toan');
}

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

  // Helper check manager kế toán (như logic cũ của bạn)
  const isManagerKT = isAccountingManagerFE();

  let canEdit = false;

  // --- LOGIC CHECK QUYỀN (Giữ nguyên logic cũ) ---
  if (myRole === 'admin') {
    canEdit = true;
  } else if (myRole === 'manager') {
    if (isManagerKT) {
      const pbName = (x.ten_phong_ban || '').toLowerCase();
      canEdit = pbName.includes('kế toán') || pbName.includes('ke toan');
    } else if (myPB && empPB && myPB === empPB) {
      canEdit = true;
    }
  } else {
    canEdit = false;
  }

  // --- RENDER BUTTONS (Dùng Icon SVG & Class mới) ---
  let actionButtons = `
      <button class="btn-icon-only" data-act="view" title="Xem chi tiết">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
      </button>
  `;

  if (canEdit) {
    actionButtons += `
      <button class="btn-icon-only" data-act="edit" title="Chỉnh sửa">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
      </button>
    `;
  } else {
    // Logic Manager Kế toán sửa NPT
    if (myRole === 'manager' && isManagerKT) {
      const pbName = (x.ten_phong_ban || '').toLowerCase();
      const isEmpKeToan =
        pbName.includes('kế toán') || pbName.includes('ke toan');

      if (!isEmpKeToan) {
        actionButtons += `
          <button class="btn-icon-only" data-act="edit" title="Chỉ sửa NPT">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
          </button>
        `;
      }
    }
  }

  if (myRole === 'admin') {
    actionButtons += `
      <button class="btn-icon-only delete" data-act="del" title="Xóa">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      </button>
    `;
  }

  // --- XỬ LÝ TRẠNG THÁI & AVATAR ---
  const statusMap = {
    dang_lam: 'Đang làm',
    tam_nghi: 'Tạm nghỉ',
    da_nghi: 'Đã nghỉ',
  };
  const statusText = statusMap[x.trang_thai] || x.trang_thai;
  const statusClass = `bg-${x.trang_thai}`; // Class CSS tương ứng màu

  const avatarUrl = x.anh_dai_dien || './assets/img/no-avatar.png';

  // --- TRẢ VỀ HTML ---
  return `<tr data-id="${x.id}">
    <td class="col-id text-muted">#${x.id}</td>
    <td>
      <div class="user-cell">
        <!-- Đã xóa onerror để tránh lỗi Security -->
        <img src="${avatarUrl}" class="user-avatar" alt="Avatar">
        <div class="user-info">
            <span class="user-name">${esc(x.ho_ten)}</span>
            <span class="user-sub">${esc(x.email || '')}</span>
        </div>
      </div>
    </td>
    <td class="text-center">${esc(x.gioi_tinh || '')}</td>
    <td>
        <div style="font-weight:500">${esc(x.ten_chuc_vu || '')}</div>
        <div class="text-muted" style="font-size:12px">${esc(
          x.ten_phong_ban || ''
        )}</div>
    </td>
    <td>
        ${
          x.so_dien_thoai
            ? `<div><span class="text-muted">📞</span> ${esc(
                x.so_dien_thoai
              )}</div>`
            : ''
        }
    </td>
    <td>${
      x.ngay_vao_lam ? new Date(x.ngay_vao_lam).toLocaleDateString('vi-VN') : ''
    }</td>
    <td class="text-center">${x.so_nguoi_phu_thuoc ?? 0}</td>
    <td class="text-center">
        <span class="badge-status ${statusClass}">${statusText}</span>
    </td>
    <td class="text-right">
        <div style="display:flex;justify-content:flex-end;gap:4px">
            ${actionButtons}
        </div>
    </td>
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
  $('#nv-so_nguoi_phu_thuoc').value = item?.so_nguoi_phu_thuoc ?? 0;
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
    // xử lý riêng cho số NPT, nên bỏ qua ở đây
    if (input.id === 'nv-so_nguoi_phu_thuoc') return;
    input.readOnly = isView;
    input.disabled = isView;
  });

  // Admin: vẫn được sửa PB & CV khi không phải view
  if (st.ROLE === 'admin') {
    pbSelect.disabled = isView ? true : false;
    cvSelect.disabled = isView ? true : false;
  } else if (st.ROLE === 'manager' && isAccountingManagerFE()) {
    // Manager kế toán: PB & CV luôn bị khóa (như bạn đã muốn)
    pbSelect.disabled = true;
    cvSelect.disabled = true;
  }

  /* =======================================================
     ⭐ XỬ LÝ RIÊNG SỐ NGƯỜI PHỤ THUỘC
  ======================================================= */
  const sptInput = $('#nv-so_nguoi_phu_thuoc');
  const sptNote = $('#nv-spt-note');

  const isKeToanMgr = isAccountingManagerFE();
  const empPhongBanName = item?.ten_phong_ban || '';
  const isNVPhongKeToan = isPhongKeToan(empPhongBanName);

  const myPB = st.USER?.phong_ban_id || null;
  const empPB = item?.phong_ban_id || null;
  const isSameDepart = myPB && empPB && myPB === empPB;

  let canEditSPT = false;
  let noteText = '';

  if (isView) {
    canEditSPT = false;
  } else if (st.ROLE === 'admin') {
    // Admin sửa được số NPT của tất cả
    canEditSPT = true;
  } else if (st.ROLE === 'manager') {
    if (isKeToanMgr) {
      // Manager Kế Toán: sửa được số NPT của tất cả NV
      canEditSPT = true;
      if (!isNVPhongKeToan) {
        noteText = '(Chỉ sửa được số người phụ thuộc)';
      }
    } else if (isSameDepart) {
      // Manager thường: sửa NV phòng mình (bao gồm số NPT)
      canEditSPT = true;
    }
  }

  sptInput.disabled = !canEditSPT;
  sptInput.readOnly = !canEditSPT;
  if (sptNote) sptNote.textContent = noteText;

  if (!canEditSPT) {
    sptInput.style.backgroundColor = '#f0f0f0';
    sptInput.style.cursor = 'not-allowed';
  } else {
    sptInput.style.backgroundColor = '';
    sptInput.style.cursor = '';
  }

  /* =======================================================
     ⭐ Manager Kế Toán xem NV PHÒNG KHÁC: khóa các trường khác
  ======================================================= */
  if (!isView && st.ROLE === 'manager' && isKeToanMgr && !isNVPhongKeToan) {
    allInputs.forEach((input) => {
      if (input.id === 'nv-so_nguoi_phu_thuoc') return;
      input.disabled = true;
      input.readOnly = true;
    });
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
  // 1. Nút Refresh
  $('#nv-btn-refresh').addEventListener('click', () => {
    st.page = 1;
    $('#nv-search').value = '';
    $('#nv-phongban').value = '';
    $('#nv-chucvu').value = '';
    fetchList();
  });

  // 2. Nút Search & Filter
  $('#nv-btn-search').addEventListener('click', fetchList);

  // 3. Dropdown phòng ban (để load chức vụ tương ứng)
  $('#nv-phong_ban_id').addEventListener('change', async (e) => {
    const pbId = e.target.value;
    await loadChucVus(pbId);
    $('#nv-chuc_vu_id').value = '';
  });

  // 4. Preview ảnh khi upload
  $('#nv-anh_dai_dien').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      $('#nv-preview').src = URL.createObjectURL(file);
      $('#nv-preview').style.display = 'block';
    }
  });

  // 5. Nút Tạo mới
  $('#nv-btn-create').addEventListener('click', () =>
    st.IS_MANAGER_OR_ADMIN
      ? openModal(null, 'edit')
      : alert('Bạn không có quyền')
  );

  // 6. Nút Đóng/Hủy Modal
  $('#nv-cancel').addEventListener('click', closeModal);

  // 7. SUBMIT FORM (Logic giữ nguyên)
  $('#nv-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!st.IS_MANAGER_OR_ADMIN) {
      showErr('Bạn không có quyền thực hiện thao tác này.');
      return;
    }

    const editingItem = st.list.find((x) => x.id == st.editingId);
    const isKeToanMgr = isAccountingManagerFE();
    const isNVPhongKeToan = editingItem
      ? isPhongKeToan(editingItem.ten_phong_ban)
      : false;

    // CASE: Manager Kế toán sửa NPT nhân viên phòng khác
    if (
      st.editingId &&
      st.ROLE === 'manager' &&
      isKeToanMgr &&
      !isNVPhongKeToan
    ) {
      try {
        const so_nguoi_phu_thuoc =
          Number($('#nv-so_nguoi_phu_thuoc').value) || 0;
        await api(`/nhan-vien/${st.editingId}/nguoi-phu-thuoc`, {
          method: 'PATCH',
          body: { so_nguoi_phu_thuoc },
        });
        closeModal();
        fetchList();
        return;
      } catch (err) {
        showErr(err?.message || 'Lỗi cập nhật số người phụ thuộc');
        return;
      }
    }

    // CASE: Bình thường (Tạo mới / Sửa full)
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
      so_nguoi_phu_thuoc: Number($('#nv-so_nguoi_phu_thuoc').value) || 0,
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
        headers: { Authorization: `Bearer ${getToken()}` },
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

  // 8. SỰ KIỆN CLICK TRONG BẢNG (QUAN TRỌNG NHẤT: ĐÃ SỬA SELECTOR)
  $('#nv-tbody').addEventListener('click', async (e) => {
    // Tìm dòng chứa ID
    const row = e.target.closest('tr[data-id]');
    if (!row) return;
    const id = row.dataset.id;

    // TÌM NÚT CÓ DATA-ACT (Bất kể icon hay button)
    const btn = e.target.closest('button[data-act]');
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

  // 9. Logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearAuth();
      location.href = './dang-nhap.html';
    });
  }
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
