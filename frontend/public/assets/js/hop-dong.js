// hop-dong.js - THÊM PHÂN TRANG
import { api, getUser, requireAuthOrRedirect, logout } from './api.js';

const ITEMS_PER_PAGE = 8;

const state = {
  items: [],
  nhanViens: [],
  editing: null,
  saving: false,
  currentPage: 1,
  totalItems: 0,
  perm: {
    isAccountingManager: false,
  },
};

//window.__HD_STATE__ = state;

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) =>
  (s ?? '').toString().replace(
    /[&<>\"']/g,
    (m) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      }[m])
  );

const formatDate = (d) => {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date)) return '';
  return date.toLocaleDateString('vi-VN');
};

const unwrap = (resp) => {
  if (!resp) return [];

  // Trường hợp resp là mảng
  if (Array.isArray(resp)) return resp;

  // Trường hợp resp.data là mảng
  if (Array.isArray(resp.data)) return resp.data;

  // Trường hợp resp.data.items là mảng (theo log của bạn)
  if (resp.data && Array.isArray(resp.data.items)) return resp.data.items;

  return [];
};

/* ===========================================================
   LOAD DỮ LIỆU CHUNG
   =========================================================== */
async function loadNhanVienList() {
  try {
    const resp = await api('/nhan-vien', { auth: true }); // thêm { auth: true } cho chắc
    console.log('Nhan vien API resp:', resp); // DEBUG
    const data = unwrap(resp);
    console.log('Nhan vien after unwrap:', data); // DEBUG
    state.nhanViens = Array.isArray(data) ? data : [];
    window.__HD_STATE__ = state; // cập nhật lại debug
  } catch (e) {
    console.error('Error loading Nhan Vien list:', e);
  }
}

async function loadPermissions() {
  try {
    const resp = await api('/hop-dong/_permissions/me', { auth: true });
    if (resp && typeof resp.isAccountingManager !== 'undefined') {
      state.perm.isAccountingManager = !!resp.isAccountingManager;
    }
  } catch (e) {
    console.error('Error loading hop-dong permissions:', e);
    state.perm.isAccountingManager = false;
  }
}

async function fetchList(user) {
  try {
    const qs = new URLSearchParams();

    const loai = $('#filter_loai').value;
    const tt = $('#filter_trang_thai').value;
    const tu = $('#filter_tu_ngay').value;
    const den = $('#filter_den_ngay').value;

    if (loai) qs.append('loai_hop_dong', loai);
    if (tt) qs.append('trang_thai', tt);
    if (tu) qs.append('tu_ngay', tu);
    if (den) qs.append('den_ngay', den);

    const resp = await api(`/hop-dong?${qs.toString()}`);
    const allItems = unwrap(resp);

    state.items = allItems;
    state.totalItems = allItems.length;

    state.currentPage = 1;
    renderTable(user);
    updatePagination();
  } catch (e) {
    console.error('Error:', e);
  }
}

/* ===========================================================
   PHÂN TRANG - HÀM HỖ TRỢ
   =========================================================== */
function getPaginatedItems() {
  const start = (state.currentPage - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  return state.items.slice(start, end);
}

function getTotalPages() {
  return Math.ceil(state.totalItems / ITEMS_PER_PAGE);
}

function updatePagination() {
  const totalPages = getTotalPages();
  const pageInfo = $('#pageInfo');
  const btnPrev = $('#btnPrev');
  const btnNext = $('#btnNext');

  if (pageInfo)
    pageInfo.textContent = `Trang ${state.currentPage}/${totalPages}`;
  if (btnPrev) btnPrev.disabled = state.currentPage === 1;
  if (btnNext) btnNext.disabled = state.currentPage === totalPages;
}

/* ===========================================================
   RENDER TABLE
   =========================================================== */
function renderTable(user) {
  const body = $('#contractsBody');
  const paginatedItems = getPaginatedItems();

  if (!state.items.length) {
    body.innerHTML = `<tr><td colspan="13" class="text-muted">Không có dữ liệu</td></tr>`;
    return;
  }

  if (!paginatedItems.length) {
    body.innerHTML = `<tr><td colspan="13" class="text-muted">Không có dữ liệu trang này</td></tr>`;
    return;
  }

  const isAdmin = user.role === 'admin';
  const isManager = user.role === 'manager';

  body.innerHTML = paginatedItems
    .map((c) => {
      const sumPC =
        c.tong_phu_cap !== undefined
          ? c.tong_phu_cap
          : (c.phu_caps || []).reduce(
              (s, it) => s + Number(it.so_tien || 0),
              0
            );

      return `
      <tr>
        <td data-label="ID">${c.id}</td>
        <td data-label="Nhân viên">${esc(c.ho_ten || '')}</td>
        <td data-label="Số HĐ">${esc(c.so_hop_dong || '')}</td>
        <td data-label="Loại HĐ">${esc(c.loai_hop_dong || '')}</td>
        <td data-label="Ngày ký">${esc(formatDate(c.ngay_ky))}</td>
        <td data-label="Bắt đầu">${esc(formatDate(c.ngay_bat_dau))}</td>
        <td data-label="Kết thúc">${esc(formatDate(c.ngay_ket_thuc))}</td>
        <td data-label="Lương" class="salary-cell">
          ${Number(c.luong_thoa_thuan || 0).toLocaleString('vi-VN')} ₫
        </td>
        <td data-label="Phụ cấp" class="allowance-cell">
          ${sumPC.toLocaleString('vi-VN')} ₫
        </td>
        <td data-label="Trạng thái" class="status-cell">
          <span class="status-badge status-${
            c.trang_thai?.replace(/ /g, '-') || 'con_hieu_luc'
          }">
            ${esc(c.trang_thai || '')}
          </span>
        </td>
        <td data-label="Ghi chú">
          ${esc(c.ghi_chu || '').substring(0, 30)}${
        c.ghi_chu?.length > 30 ? '...' : ''
      }
        </td>
        <td data-label="Tài liệu">
          ${
            c.file_hop_dong
              ? `<a href="${esc(c.file_hop_dong)}" target="_blank">📄 Xem</a>`
              : ''
          }
        </td>
        <td data-label="Hành động" class="action-cell">
          <button class="btn btn-sm btn-view" data-action="view" data-id="${
            c.id
          }">👀</button>
          ${
            isAdmin
              ? `<button class="btn btn-sm btn-edit" data-action="edit" data-id="${c.id}">✏️</button>`
              : ''
          }
          ${
            isAdmin
              ? `<button class="btn btn-sm btn-del" data-action="del" data-id="${c.id}">🗑️</button>`
              : ''
          }
        </td>
      </tr>
    `;
    })
    .join('');
}

/* ===========================================================
   MODAL TẠO/SỬA
   =========================================================== */
function openModal(contract, user) {
  const modal = $('#contractModal');
  const form = $('#contractForm');
  state.editing = contract;

  $('#modalTitle').textContent = contract ? 'Sửa Hợp đồng' : 'Tạo Hợp đồng Mới';
  form.reset();

  $('#loai_hop_dong').addEventListener('change', (e) => {
    $('#ngayKetThucGroup').style.display =
      e.target.value === 'Xác định thời hạn' ? 'block' : 'none';
    $('#ngay_ket_thuc').required = e.target.value === 'Xác định thời hạn';
  });

  const nvInput = $('#nhan_vien_id_input');
  const nvIdHidden = $('#nhan_vien_id');
  const nvDropdown = $('#nhanVienDropdown');

  nvInput.disabled = !!contract;

  nvInput.disabled = !!contract;

  nvInput.oninput = () => {
    const query = (nvInput.value || '').toLowerCase().trim();

    // DEBUG: kiểm tra dữ liệu nhân viên
    //console.log('NhanViens:', state.nhanViens);
    //console.log('Query:', query);

    if (!query) {
      nvDropdown.innerHTML = '';
      nvDropdown.style.display = 'none';
      return;
    }

    // Nếu chưa load được danh sách nhân viên
    if (!Array.isArray(state.nhanViens) || state.nhanViens.length === 0) {
      nvDropdown.innerHTML =
        '<div style="padding:4px 8px; color:#888;">Không có dữ liệu nhân viên</div>';
      nvDropdown.style.display = 'block';
      return;
    }

    const items = state.nhanViens
      .filter((nv) => {
        const name = (nv.ho_ten || '').toLowerCase();
        const idStr = String(nv.id ?? '');
        const code = (nv.ma_nhan_vien || '').toLowerCase();
        return (
          name.includes(query) || idStr.includes(query) || code.includes(query)
        );
      })
      .slice(0, 10);

    if (!items.length) {
      nvDropdown.innerHTML =
        '<div style="padding:4px 8px; color:#888;">Không tìm thấy nhân viên phù hợp</div>';
      nvDropdown.style.display = 'block';
      return;
    }

    nvDropdown.innerHTML = items
      .map((nv) => {
        const name = esc(nv.ho_ten || 'Không tên');
        const code = esc(nv.ma_nhan_vien || '');
        return `<div data-id="${nv.id}" data-name="${name}">
          ${name}${code ? ` (${code})` : ''}
        </div>`;
      })
      .join('');

    nvDropdown.style.display = 'block';
  };

  nvDropdown.onclick = (e) => {
    const div = e.target.closest('div[data-id]');
    if (div) {
      nvInput.value = div.dataset.name;
      nvIdHidden.value = div.dataset.id;
      nvDropdown.style.display = 'none';
    }
  };

  if (contract) {
    nvInput.value = contract.ho_ten || '';
    nvIdHidden.value = contract.nhan_vien_id || '';
    $('#so_hop_dong').value = contract.so_hop_dong || '';
    $('#loai_hop_dong').value = contract.loai_hop_dong || 'Thử việc';
    $('#ngay_ky').value = contract.ngay_ky
      ? contract.ngay_ky.substring(0, 10)
      : '';
    $('#ngay_bat_dau').value = contract.ngay_bat_dau
      ? contract.ngay_bat_dau.substring(0, 10)
      : '';
    $('#ngay_ket_thuc').value = contract.ngay_ket_thuc
      ? contract.ngay_ket_thuc.substring(0, 10)
      : '';
    $('#luong_thoa_thuan').value = contract.luong_thoa_thuan || 0;
    $('#trang_thai').value = contract.trang_thai || 'con_hieu_luc';
    $('#ghi_chu').value = contract.ghi_chu || '';
  } else {
    $('#loai_hop_dong').value = 'Thử việc';
    $('#ngay_ket_thuc').required = false;
  }

  $('#loai_hop_dong').dispatchEvent(new Event('change'));
  modal.showModal();
}

function closeModal() {
  $('#contractModal').close();
  state.editing = null;
}

/* ===========================================================
   HANDLE SUBMIT
   =========================================================== */
async function handleSubmit(user) {
  if (state.saving) return;

  const method = state.editing ? 'PUT' : 'POST';
  const url = state.editing ? `/hop-dong/${state.editing.id}` : '/hop-dong';

  const formData = new FormData();
  formData.append('nhan_vien_id', $('#nhan_vien_id').value);
  formData.append('so_hop_dong', $('#so_hop_dong').value);
  formData.append('loai_hop_dong', $('#loai_hop_dong').value);
  formData.append('ngay_ky', $('#ngay_ky').value);
  formData.append('ngay_bat_dau', $('#ngay_bat_dau').value);
  formData.append('luong_thoa_thuan', $('#luong_thoa_thuan').value);
  formData.append('trang_thai', $('#trang_thai').value);
  formData.append('ghi_chu', $('#ghi_chu').value);

  if ($('#loai_hop_dong').value === 'Xác định thời hạn') {
    formData.append('ngay_ket_thuc', $('#ngay_ket_thuc').value);
  } else {
    formData.append('ngay_ket_thuc', '');
  }

  const fileInput = $('#file_hop_dong');
  if (fileInput.files.length > 0) {
    formData.append('file_hop_dong', fileInput.files[0]);
  }

  state.saving = true;
  $('#btnSave').textContent = 'Đang lưu...';
  $('#btnSave').disabled = true;

  try {
    const resp = await api(url, {
      method,
      auth: true,
      body: formData,
    });

    if (resp?.error) {
      alert(`Lỗi: ${resp.error}`);
      return;
    }

    closeModal();
    await fetchList(user);
  } catch (e) {
    console.error('Save error:', e);
    alert('Lỗi hệ thống khi lưu hợp đồng.');
  } finally {
    state.saving = false;
    $('#btnSave').textContent = 'Lưu';
    $('#btnSave').disabled = false;
  }
}

function showConfirm(user) {
  const isEditing = !!state.editing;
  const actionText = isEditing ? 'Sửa' : 'Tạo mới';

  if (confirm(`Bạn có chắc chắn muốn ${actionText} hợp đồng này không?`)) {
    handleSubmit(user);
  }
}

/* ===========================================================
   MODAL XEM CHI TIẾT
   =========================================================== */
function openViewModal(contract) {
  const modal = $('#viewModal');
  const content = $('#contractDetailContent');

  const phuCapsHtml = (contract.phu_caps || [])
    .map(
      (pc) => `
        <tr class="detail-row">
            <td class="detail-label" style="width:50%;"> - ${esc(
              pc.ten_phu_cap || 'Chưa đặt tên'
            )}</td>
            <td class="detail-value" style="text-align: right;">${Number(
              pc.so_tien ?? 0
            ).toLocaleString('vi-VN')} ₫</td>
        </tr>
      `
    )
    .join('');

  const data = {
    'ID Hợp đồng': contract.id,
    'Nhân viên': contract.ho_ten || contract.nhan_vien_id,
    'Số hợp đồng': contract.so_hop_dong || 'N/A',
    'Loại hợp đồng': contract.loai_hop_dong || 'N/A',
    'Ngày ký': formatDate(contract.ngay_ky) || 'N/A',
    'Ngày bắt đầu': formatDate(contract.ngay_bat_dau) || 'N/A',
    'Ngày kết thúc': formatDate(contract.ngay_ket_thuc) || 'Không xác định',
    'Lương thỏa thuận':
      Number(contract.luong_thoa_thuan ?? 0).toLocaleString('vi-VN') + ' ₫',
    'Trạng thái': `<span class="status-badge status-${
      contract.trang_thai.replace(/ /g, '-') || 'con_hieu_luc'
    }">${contract.trang_thai}</span>`,
    'Ghi chú': esc(contract.ghi_chu) || 'Không có',
    'Tài liệu': contract.file_hop_dong
      ? `<a href="${esc(
          contract.file_hop_dong
        )}" target="_blank" class="btn-sm btn-link">Tải về</a>`
      : 'Không có',
  };

  content.innerHTML = `
      <table class="detail-table"><tbody>
        ${Object.entries(data)
          .map(
            ([label, value]) => `
            <tr class="detail-row">
                <td class="detail-label">${label}</td>
                <td class="detail-value">${value}</td>
            </tr>
          `
          )
          .join('')}
        
        <tr class="detail-row header-row">
          <td colspan="2" class="detail-label" style="font-weight: bold; padding-top: 15px;">Phụ cấp chi tiết (Tổng: ${Number(
            contract.tong_phu_cap ?? 0
          ).toLocaleString('vi-VN')} ₫):</td>
        </tr>
        <tr>
          <td colspan="2" style="padding: 0;">
            <table class="nested-table">
              <tbody>${
                phuCapsHtml ||
                '<tr><td colspan="2" style="text-align: center; font-style: italic; border: none;">Không có phụ cấp chi tiết</td></tr>'
              }</tbody>
            </table>
          </td>
        </tr>
      </tbody></table>
    `;
  modal.showModal();
}

document.addEventListener('DOMContentLoaded', function () {
  const closeButton = document.getElementById('nut-dong-modal');
  if (closeButton) {
    closeButton.addEventListener('click', function () {
      const viewModal = document.getElementById('viewModal');
      if (viewModal) {
        viewModal.close();
      }
    });
  }
});

/* ===========================================================
   BIND EVENTS
   =========================================================== */
function bindEvents(user) {
  $('#btnCancel').addEventListener('click', closeModal);
  $('#contractForm').addEventListener('submit', (e) => {
    e.preventDefault();
    showConfirm(user);
  });

  // Nút Thêm: tạm thời chỉ cho Admin để test
  if (user.role === 'admin') {
    $('#btnAdd').classList.remove('hidden');
    $('#btnAdd').addEventListener('click', () => openModal(null, user));
  } else {
    $('#btnAdd').classList.add('hidden');
  }

  $('#btnFilter').addEventListener('click', () => fetchList(user));

  $('#btnReset').addEventListener('click', () => {
    $('#filter_loai').value = '';
    $('#filter_trang_thai').value = '';
    $('#filter_tu_ngay').value = '';
    $('#filter_den_ngay').value = '';
    fetchList(user);
  });

  // CLICK TRONG BẢNG
  $('#contractsBody').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const ct = state.items.find((c) => String(c.id) === String(id));

    if (!ct && action !== 'del') return;

    if (action === 'view') {
      openViewModal(ct);
      return;
    }

    if (action === 'edit' && user.role === 'admin') {
      openModal(ct, user);
      return;
    }

    if (action === 'del' && user.role === 'admin') {
      if (!confirm(`Xoá hợp đồng #${id}?`)) return;
      await api(`/hop-dong/${id}`, { method: 'DELETE', auth: true });
      await fetchList(user);
      return;
    }
  });

  // PHÂN TRANG
  const btnPrev = $('#btnPrev');
  const btnNext = $('#btnNext');

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (state.currentPage > 1) {
        state.currentPage--;
        renderTable(user);
        updatePagination();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      const totalPages = getTotalPages();
      if (state.currentPage < totalPages) {
        state.currentPage++;
        renderTable(user);
        updatePagination();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }
}

/* ===========================================================
   INIT
   =========================================================== */
async function init() {
  requireAuthOrRedirect('./dang-nhap.html');

  const user = getUser();
  if (!user) return;

  await loadPermissions();

  await loadNhanVienList();
  await fetchList(user);
  bindEvents(user);
}

init();
