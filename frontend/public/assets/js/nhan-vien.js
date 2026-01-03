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

  if (!st.IS_ADMIN) {
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
  } else if (st.ROLE === 'manager' && isManagerKT) {
    canEdit = x.loai === 'NPT'; // hoặc điều kiện đối tượng NPT
  } else if (myRole === 'manager') {
    if (x.id === st.USER.nhan_vien_id) {
      canEdit = true; // Manager chỉ sửa được chính mình
    } else {
      canEdit = false; // Không sửa NV khác
    }
  } else if (myRole === 'employee') {
    canEdit = x.id === st.USER?.nhan_vien_id; // Nhân viên bình thường
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
            ? `<div><span class="text-muted"><i class="fa-solid fa-phone" style="color:#36b9cc"></i></span> ${esc(
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
   LOAD PHÒNG BAN  
========================================================== */
async function loadPhongBans() {
  let items = [];
  const filterPB = $('#nv-phongban');
  const modalPB = $('#nv-phong_ban_id');

  // 1. Fetch dữ liệu dựa trên quyền
  if (st.ROLE === 'admin' || isAccountingManagerFE()) {
    const res = await api('/phong-ban?limit=500').catch(() => null);
    items = res?.data?.items || res?.items || res?.data || [];
    st.phongBans = items;

    const options =
      `<option value="">-- Tất cả phòng ban --</option>` +
      items
        .map((x) => `<option value="${x.id}">${esc(x.ten_phong_ban)}</option>`)
        .join('');

    filterPB.innerHTML = options;
    modalPB.innerHTML = options;

    if (isAccountingManagerFE()) filterPB.value = '';
  } else {
    // Manager thường hoặc Employee: Chỉ lấy PB của chính mình từ st.USER
    const pbId = st.USER?.phong_ban_id;
    const pbName = st.USER?.ten_phong_ban || 'Phòng ban của tôi';

    if (pbId) {
      const options = `<option value="${pbId}">${esc(pbName)}</option>`;
      filterPB.innerHTML = options;
      modalPB.innerHTML = options;
      filterPB.value = pbId;
    }
  }
}

/* ==========================================================
   LOAD CHỨC VỤ  
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
   OPEN MODAL 
========================================================== */
async function openModal(item = null, mode = 'edit') {
  const errorEl = $('#nv-error');
  if (errorEl) {
    errorEl.hidden = true;
    errorEl.textContent = '';
  }

  st.editingId = item?.id ?? null;
  if (item?.id) {
    try {
      const res = await api(`/nhan-vien/${item.id}`);
      if (res?.data) {
        item = res.data;
      }
    } catch (e) {
      console.warn(
        'Không lấy được chi tiết nhân viên, dùng dữ liệu trong list'
      );
    }
  }

  const isSelf = st.USER?.nhan_vien_id === item?.id;
  const isView = mode === 'view';

  const isSysAdmin = st.ROLE === 'admin';
  const isKeToanMgr = isAccountingManagerFE();

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
     PHÒNG BAN — Khóa nếu không phải Admin
  ======================================================= */
  const pbSelect = $('#nv-phong_ban_id');
  const employeePB = item?.phong_ban_id || '';
  const employeePBName = item?.ten_phong_ban || '';

  const canAdminEditPB = isSysAdmin && !isView;

  pbSelect.innerHTML = '';

  if (isSysAdmin) {
    pbSelect.disabled = !canAdminEditPB;
    pbSelect.innerHTML =
      `<option value="">-- Chọn phòng ban --</option>` +
      st.phongBans
        .map((x) => `<option value="${x.id}">${esc(x.ten_phong_ban)}</option>`)
        .join('');
    pbSelect.value = employeePB;
  } else {
    //  chỉ hiển thị PB hiện tại
    pbSelect.disabled = true;

    if (isKeToanMgr) {
      pbSelect.innerHTML =
        `<option value="">-- Chọn phòng ban --</option>` +
        st.phongBans
          .map(
            (x) => `<option value="${x.id}">${esc(x.ten_phong_ban)}</option>`
          )
          .join('');
    } else {
      // Manager thường & Employee → chỉ hiển PB của nhân viên
      pbSelect.innerHTML = `<option value="${employeePB}">${esc(
        employeePBName
      )}</option>`;
    }
    pbSelect.value = employeePB;
  }

  /* =======================================================
     CHỨC VỤ — Khóa nếu không phải Admin
  ======================================================= */
  const cvSelect = $('#nv-chuc_vu_id');
  const employeeCV = item?.chuc_vu_id || '';
  const employeeCVName = item?.ten_chuc_vu || '';
  const usedPB = employeePB || $('#nv-phong_ban_id').value;

  const isAdminCanEditCV = isSysAdmin && !isView;

  cvSelect.disabled = !isAdminCanEditCV;

  if (isAdminCanEditCV) {
    // ==== ADMIN (có quyền sửa/tạo mới) ====
    await loadChucVus(usedPB);
    cvSelect.value = employeeCV;
  } else {
    // ==== MANAGER & EMPLOYEE (chỉ xem hoặc không có quyền sửa) ====
    cvSelect.innerHTML = `<option value="${employeeCV}">${esc(
      employeeCVName
    )}</option>`;
    cvSelect.value = employeeCV;
  }

  /* =======================================================
     KHÓA INPUT CHUNG VÀ MỞ KHÓA CHO SỬA THÔNG TIN CÁ NHÂN
  ======================================================= */
  const allInputs = $('#nv-form').querySelectorAll('input, select, textarea');

  // Xác định ai có quyền SỬA các trường thông thường
  let canEditGeneralInfo = isSysAdmin && !isView;

  // Manager/Employee có thể sửa thông tin chung của chính mình (nếu không phải view)
  if (!isSysAdmin && isSelf && !isView) {
    canEditGeneralInfo = true;
  }

  // Khóa tất cả input mặc định
  allInputs.forEach((input) => {
    // Xử lý riêng các trường đặc biệt
    if (input.id === 'nv-so_nguoi_phu_thuoc') return;
    if (isSelf && (input.id === 'nv-old-pass' || input.id === 'nv-new-pass')) {
      return; // Xử lý riêng mật khẩu
    }

    // BỎ QUA các trường quản lý đã được xử lý khóa riêng ở trên (PB, CV)
    if (
      input.id === 'nv-phong_ban_id' ||
      input.id === 'nv-chuc_vu_id' ||
      input.id === 'nv-trang_thai'
    ) {
      return;
    }

    // Nếu không có quyền sửa thông tin chung, hoặc đang ở chế độ xem
    if (!canEditGeneralInfo || isView) {
      input.readOnly = true;
      input.disabled = true;
    } else {
      input.readOnly = false;
      input.disabled = false;
    }
  });

  // Khóa trường Trạng thái cho tất cả trừ Admin
  if ($('#nv-trang_thai')) {
    $('#nv-trang_thai').disabled = !canAdminEditPB;
  }

  /* =======================================================
     XỬ LÝ RIÊNG SỐ NGƯỜI PHỤ THUỘC (Chỉ cho Admin/Manager KT sửa)
  ======================================================= */
  const sptInput = $('#nv-so_nguoi_phu_thuoc');
  const sptNote = $('#nv-spt-note');

  const empPhongBanName = item?.ten_phong_ban || '';
  const isNVPhongKeToan = isPhongKeToan(empPhongBanName);

  const myPB = st.USER?.phong_ban_id || null;
  const empPB = item?.phong_ban_id || null;
  const isSameDepart = myPB && empPB && myPB === empPB;

  let canEditSPT = false;
  let noteText = '';

  if (isView) {
    canEditSPT = false;
  } else if (isSysAdmin) {
    canEditSPT = true;
  } else if (st.ROLE === 'manager') {
    if (isKeToanMgr) {
      canEditSPT = true;
      if (!isNVPhongKeToan) {
        noteText = '(Chỉ sửa được số người phụ thuộc)';
      }
    } else if (isSameDepart) {
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
      // Bỏ qua trường mật khẩu
      if (
        isSelf &&
        (input.id === 'nv-old-pass' || input.id === 'nv-new-pass')
      ) {
        return;
      }
      if (input.id === 'nv-so_nguoi_phu_thuoc') return;
      input.disabled = true;
      input.readOnly = true;
    });
  }

  /* =======================================================
   TẢI THÔNG TIN TÀI KHOẢN (chỉ khi xem chính mình)
======================================================= */

  const accBlock = $('#nv-account-block');
  const passSec = $('#nv-password-section');
  const msg = $('#nv-pass-msg');

  accBlock.style.display = 'none';
  passSec.style.display = 'none';
  msg.textContent = '';

  if (item?.id) {
    if (isSelf || isSysAdmin) {
      try {
        const tkRes = await api(`/tai-khoan/by-nhan-vien/${item.id}`);
        const acc = tkRes?.data;

        if (acc) {
          accBlock.style.display = 'block';
          $('#nv-tk-username').value = acc.ten_dang_nhap || '';

          // Admin không được đổi mật khẩu tại đây
          if (isSelf && st.ROLE !== 'admin') {
            passSec.style.display = 'block';
          }
        }
      } catch (e) {
        console.warn('Không lấy được tài khoản');
      }
    }
  }

  /* =======================================================
     NÚT LƯU / HỦY (Đảm bảo hiển thị khi có quyền sửa)
  ======================================================= */
  let shouldShowSaveButton = false;

  // 1. Admin luôn được lưu (trừ view)
  if (isSysAdmin && !isView) {
    shouldShowSaveButton = true;
  }
  // 2. Employee/Manager sửa thông tin chung của chính mình
  else if (canEditGeneralInfo && !isSysAdmin && !isView) {
    shouldShowSaveButton = true;
  }
  // 3. Employee/Manager sửa mật khẩu của chính mình
  else if (
    isSelf &&
    !isView &&
    st.ROLE !== 'admin' &&
    passSec.style.display !== 'none'
  ) {
    shouldShowSaveButton = true;
  }
  // 4. Manager Kế toán sửa SPT
  else if (
    !isView &&
    st.ROLE === 'manager' &&
    isKeToanMgr &&
    sptInput &&
    !sptInput.disabled
  ) {
    shouldShowSaveButton = true;
  }

  $('#nv-save').style.display = shouldShowSaveButton ? 'block' : 'none';
  $('#nv-cancel').textContent = isView ? 'Đóng' : 'Hủy';

  /* =======================================================
     HIỂN THỊ NÚT >> TỔNG QUAN
  ======================================================= */
  const overviewBtn = $('#nv-overview-toggle');
  if (overviewBtn) {
    if (item?.id) {
      overviewBtn.style.display = 'flex';
      overviewBtn.onclick = () => {
        openOverviewPanel(item.id);
      };
    } else {
      overviewBtn.style.display = 'none';
      overviewBtn.onclick = null;
    }
  }

  // Đảm bảo bắt đầu ở chế độ FORM mỗi lần mở
  closeOverviewPanel();

  $('#nv-modal').showModal();
}

/* ==========================================================
   CLOSE MODAL
========================================================== */
function closeModal() {
  $('#nv-modal').close();
  const overviewBtn = $('#nv-overview-toggle');
  if (overviewBtn) {
    overviewBtn.style.display = 'none';
    overviewBtn.onclick = null;
  }

  closeOverviewPanel();
}

function renderOverviewHtml(d) {
  const {
    nhan_vien,
    hop_dong,
    cham_cong,
    phu_cap,
    luong,
    thuong_phat,
    thang,
    nam,
  } = d;

  // ====== HỢP ĐỒNG ======
  const hdHtml = hop_dong
    ? `
      <div><b>Số HĐ:</b> ${esc(hop_dong.so_hop_dong || '')}</div>
      <div><b>Loại:</b> ${esc(hop_dong.loai_hop_dong || '')}</div>
      <div><b>Ngày ký:</b> ${esc(hop_dong.ngay_ky || '')}</div>
      <div><b>Ngày bắt đầu:</b> ${esc(hop_dong.ngay_bat_dau || '')}</div>
      <div><b>Ngày kết thúc:</b> ${
        hop_dong.ngay_ket_thuc ? esc(hop_dong.ngay_ket_thuc) : 'Không xác định'
      }</div>
      <div><b>Lương thỏa thuận:</b> ${
        hop_dong.luong_thoa_thuan != null
          ? Number(hop_dong.luong_thoa_thuan).toLocaleString('vi-VN') + ' đ'
          : ''
      }</div>
    `
    : `<div class="nv-overview-empty">Không có hợp đồng đang hoạt động</div>`;

  // ====== LƯƠNG ======
  const luongHtml = luong
    ? `
      <div><b>Lương cơ bản:</b> ${Number(
        luong.luong_co_ban || 0
      ).toLocaleString('vi-VN')} đ</div>
      <div><b>Tổng lương:</b> ${Number(luong.tong_luong || 0).toLocaleString(
        'vi-VN'
      )} đ</div>
    `
    : `<div class="nv-overview-empty">Chưa có bảng lương tháng ${thang}/${nam}</div>`;

  // ====== PHỤ CẤP ======
  const phuCapHtml =
    phu_cap && phu_cap.length
      ? `<ul>` +
        phu_cap
          .map(
            (p) =>
              `<li>Phụ cấp #${p.id}: ${Number(p.so_tien || 0).toLocaleString(
                'vi-VN'
              )} đ${p.ghi_chu ? ' - ' + esc(p.ghi_chu) : ''}</li>`
          )
          .join('') +
        `</ul>`
      : `<div class="nv-overview-empty">Không có phụ cấp tháng này</div>`;

  // ====== THƯỞNG / PHẠT ======
  const typeMap = {
    THUONG: 'Thưởng',
    PHAT: 'Phạt',
  };

  const thuongPhatHtml =
    thuong_phat && thuong_phat.length
      ? `<ul>` +
        thuong_phat
          .map((t) => {
            const typeLabel = typeMap[t.loai] || t.loai || '';
            const money =
              t.so_tien != null
                ? Number(t.so_tien).toLocaleString('vi-VN') + ' đ'
                : '';
            const date = t.ngay_tao
              ? new Date(t.ngay_tao).toLocaleDateString('vi-VN')
              : '';
            return `<li>${date ? `[${date}] ` : ''}${typeLabel} ${
              money ? money + ' ' : ''
            }- ${esc(t.ly_do || '')}</li>`;
          })
          .join('') +
        `</ul>`
      : `<div class="nv-overview-empty">Không có thưởng/phạt tháng này</div>`;

  // ====== CHẤM CÔNG ======
  const chamCongHtml =
    cham_cong && cham_cong.length
      ? `<div>Đã ghi nhận ${cham_cong.length} dòng chấm công tháng ${thang}/${nam}</div>`
      : `<div class="nv-overview-empty">Chưa có chấm công tháng này</div>`;

  // ====== GHÉP GIAO DIỆN ======
  return `
    <div>
      <div class="nv-overview-section-title">Hợp đồng đang hoạt động</div>
      ${hdHtml}
    </div>

    <hr>

    <div>
      <div class="nv-overview-section-title">Lương tháng ${thang}/${nam}</div>
      ${luongHtml}
    </div>

    <hr>

    <div>
      <div class="nv-overview-section-title">Phụ cấp tháng ${thang}/${nam}</div>
      ${phuCapHtml}
    </div>

    <hr>

    <div>
      <div class="nv-overview-section-title">Thưởng / Phạt tháng ${thang}/${nam}</div>
      ${thuongPhatHtml}
    </div>

    <hr>

    <div>
      <div class="nv-overview-section-title">Chấm công tháng ${thang}/${nam}</div>
      ${chamCongHtml}
    </div>
  `;
}

async function openOverviewPanel(nvId) {
  const formBody = $('#nv-form-body');
  const overviewBody = $('#nv-overview-body');
  const contentEl = $('#nv-overview-content-inside');
  const toggleBtn = $('#nv-overview-toggle');

  if (!formBody || !overviewBody || !contentEl) return;

  // Nếu đang ở chế độ OVERVIEW -> quay lại FORM
  if (overviewBody.style.display !== 'none') {
    overviewBody.style.display = 'none';
    formBody.style.display = 'flex'; // modal-body-grid là flex
    if (toggleBtn) toggleBtn.innerHTML = '&raquo;'; // icon >>
    return;
  }

  // Chuyển sang OVERVIEW
  contentEl.innerHTML = '<div class="text-muted">Đang tải...</div>';

  try {
    const now = new Date();
    const thang = now.getMonth() + 1;
    const nam = now.getFullYear();

    const res = await api(
      `/nhan-vien/${nvId}/overview?thang=${thang}&nam=${nam}`
    );
    const d = res?.data ?? res;

    contentEl.innerHTML = renderOverviewHtml(d);

    formBody.style.display = 'none';
    overviewBody.style.display = 'flex'; // hoặc 'block' cũng được, vì bên trong là grid-col-right

    if (toggleBtn) toggleBtn.innerHTML = '&laquo;'; // đổi icon thành << để quay lại
  } catch (err) {
    console.error('Lỗi tải overview:', err);
    contentEl.innerHTML =
      '<div class="text-danger">Không tải được dữ liệu.</div>';
  }
}

function closeOverviewPanel() {
  const formBody = $('#nv-form-body');
  const overviewBody = $('#nv-overview-body');
  const toggleBtn = $('#nv-overview-toggle');

  if (formBody) formBody.style.display = 'flex';
  if (overviewBody) overviewBody.style.display = 'none';
  if (toggleBtn) toggleBtn.innerHTML = '&raquo;';
}

/* ==========================================================
   BIND EVENT  
========================================================== */
function bind() {
  // --- 1. NHÓM CÔNG CỤ (TOOLBAR) ---

  // Nút Làm mới (Refresh)
  $('#nv-btn-refresh')?.addEventListener('click', () => {
    st.page = 1;
    $('#nv-search').value = '';
    $('#nv-phongban').value = '';
    $('#nv-chucvu').value = '';
    // Load lại toàn bộ chức vụ khi reset phòng ban
    loadChucVus('');
    fetchList();
  });

  // Nút Tìm kiếm/Lọc
  $('#nv-btn-search')?.addEventListener('click', () => {
    st.page = 1;
    fetchList();
  });

  // Tự động lọc khi thay đổi Phòng ban ở thanh tìm kiếm
  $('#nv-phongban')?.addEventListener('change', async (e) => {
    const pbId = e.target.value;

    await loadChucVus(pbId);
    st.page = 1;
    await fetchList();
  });

  // Đồng thời thêm cho cả dropdown chức vụ để khi chọn chức vụ nó cũng tự lọc luôn
  $('#nv-chucvu')?.addEventListener('change', async () => {
    st.page = 1;
    await fetchList();
  });

  // Nút Xuất Excel
  $('#nv-btn-export')?.addEventListener('click', async () => {
    const qs = new URLSearchParams({
      search: $('#nv-search').value.trim(),
      phong_ban_id: $('#nv-phongban').value || '',
      chuc_vu_id: $('#nv-chucvu').value || '',
    });

    try {
      const base =
        typeof api.BASE_URL === 'string'
          ? api.BASE_URL
          : 'http://localhost:8001';
      const url = `${base}/nhan-vien/export?${qs.toString()}`;
      const resp = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (!resp.ok) throw new Error('Không thể xuất Excel');

      const blob = await resp.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `nhan_vien_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      alert(err.message || 'Lỗi khi tải file Excel');
    }
  });

  // Nút Thêm mới nhân viên
  $('#nv-btn-create')?.addEventListener('click', () => {
    if (st.IS_MANAGER_OR_ADMIN) {
      openModal(null, 'edit');
    } else {
      alert('Bạn không có quyền thực hiện chức năng này');
    }
  });

  // --- 2. TƯƠNG TÁC TRONG BẢNG (TABLE EVENTS) ---

  $('#nv-tbody')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;

    const row = btn.closest('tr[data-id]');
    const id = row.dataset.id;
    const act = btn.dataset.act;
    const item = st.list.find((x) => x.id == id);

    if (act === 'view') {
      openModal(item, 'view');
    } else if (act === 'edit') {
      openModal(item, 'edit');
    } else if (act === 'del') {
      if (!st.IS_ADMIN) return alert('Chỉ Admin mới có quyền xóa');
      if (confirm(`Bạn có chắc chắn muốn xóa nhân viên #${id}?`)) {
        try {
          await api(`/nhan-vien/${id}`, { method: 'DELETE' });
          fetchList();
        } catch (err) {
          alert(err.message || 'Lỗi khi xóa nhân viên');
        }
      }
    }
  });

  // --- 3. SỰ KIỆN TRONG MODAL ---

  // Đóng Modal
  $('#nv-cancel')?.addEventListener('click', closeModal);

  // Chuyển đổi giữa Form và Panel Tổng quan (Overview)
  $('#nv-overview-close')?.addEventListener('click', closeOverviewPanel);

  // Khi thay đổi Phòng ban trong Modal -> Load lại Chức vụ tương ứng
  $('#nv-phong_ban_id')?.addEventListener('change', async (e) => {
    const pbId = e.target.value;
    await loadChucVus(pbId);
    $('#nv-chuc_vu_id').value = ''; // Reset chức vụ khi đổi phòng
  });

  // Xem trước ảnh đại diện khi chọn file
  $('#nv-anh_dai_dien')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        $('#nv-preview').src = ev.target.result;
        $('#nv-preview').style.display = 'block';
      };
      reader.readAsDataURL(file);
    }
  });

  // Submit Form Lưu dữ liệu
  $('#nv-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const editingItem = st.list.find((x) => x.id == st.editingId);
    const isKeToanMgr = isAccountingManagerFE();
    const isNVPhongKeToan = editingItem
      ? isPhongKeToan(editingItem.ten_phong_ban)
      : false;

    // CASE ĐẶC BIỆT: Manager Kế toán sửa số người phụ thuộc cho nhân viên phòng khác
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
        showErr(err.message);
        return;
      }
    }

    // CASE CHUNG: Thêm mới hoặc Sửa thông tin
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

    // Xử lý upload ảnh (nếu có chọn file mới)
    const file = $('#nv-anh_dai_dien').files[0];
    if (file) {
      const fd = new FormData();
      fd.append('file', file);
      try {
        const upRes = await fetch('http://localhost:8001/upload', {
          method: 'POST',
          body: fd,
          headers: { Authorization: `Bearer ${getToken()}` },
        }).then((r) => r.json());
        if (upRes?.url) payload.anh_dai_dien = upRes.url;
      } catch (upErr) {
        console.error('Lỗi upload ảnh:', upErr);
      }
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
      fetchList();
    } catch (err) {
      showErr(err.message || 'Lỗi hệ thống khi lưu dữ liệu');
    }
  });

  // Đổi mật khẩu cho chính mình
  $('#nv-btn-change-pass')?.addEventListener('click', async () => {
    const oldp = $('#nv-old-pass').value.trim();
    const newp = $('#nv-new-pass').value.trim();
    const msg = $('#nv-pass-msg');

    if (!oldp || !newp) {
      msg.textContent = 'Vui lòng nhập đầy đủ mật khẩu cũ và mới.';
      msg.style.color = 'red';
      return;
    }

    try {
      const idTK = st.USER.id; // id của tài khoản từ /auth/me
      await api(`/tai-khoan/${idTK}/mat-khau`, {
        method: 'PATCH',
        body: { mat_khau_cu: oldp, mat_khau_moi: newp },
      });
      msg.textContent = 'Đổi mật khẩu thành công!';
      msg.style.color = 'green';
      $('#nv-old-pass').value = '';
      $('#nv-new-pass').value = '';
    } catch (err) {
      msg.textContent = err.message || 'Mật khẩu cũ không chính xác.';
      msg.style.color = 'red';
    }
  });

  // --- 4. HỆ THỐNG ---

  // Đăng xuất
  $('#logout-btn')?.addEventListener('click', () => {
    if (confirm('Bạn muốn đăng xuất?')) {
      clearAuth();
      location.href = './dang-nhap.html';
    }
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

  // 3) LẤY ĐỦ THÔNG TIN NHÂN VIÊN (phòng ban, chức vụ, tên phòng ban…)
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
