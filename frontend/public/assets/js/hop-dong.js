// hop-dong.js
import { api, getUser, requireAuthOrRedirect } from './api.js';

const ITEMS_PER_PAGE = 8;

const state = {
  items: [],
  nhanViens: [],
  phuCapLoaiList: [],
  selectedPhuCaps: [],
  editing: null,
  saving: false,
  currentPage: 1,
  totalItems: 0,
  perm: { isAccountingManager: false },
};

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) =>
  (s ?? '')
    .toString()
    .replace(
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
const formatDate = (d) => (!d ? '' : new Date(d).toLocaleDateString('vi-VN'));
const unwrap = (resp) =>
  Array.isArray(resp)
    ? resp
    : Array.isArray(resp?.data)
    ? resp.data
    : Array.isArray(resp?.data?.items)
    ? resp.data.items
    : [];

/* ==================== LOAD DỮ LIỆU ==================== */
async function loadNhanVienList() {
  try {
    const resp = await api('/nhan-vien', { auth: true });
    state.nhanViens = unwrap(resp) ?? [];
  } catch (e) {
    console.error('Error loading Nhan Vien list:', e);
  }
}

async function loadPhuCapLoai() {
  try {
    const resp = await api('/hop-dong/phu-cap-loai', { auth: true });
    const data = unwrap(resp) ?? [];
    state.phuCapLoaiList = data.filter((pc) => pc.is_fixed === 1);
  } catch (e) {
    console.error('Error loading phu cap loai:', e);
    state.phuCapLoaiList = [];
  }
}

async function loadPermissions() {
  try {
    const resp = await api('/hop-dong/_permissions/me', { auth: true });
    if (resp && typeof resp.isAccountingManager !== 'undefined') {
      state.perm.isAccountingManager = !!resp.isAccountingManager;
    }
  } catch {
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

/* ==================== PHÂN TRANG ==================== */
function getPaginatedItems() {
  const start = (state.currentPage - 1) * ITEMS_PER_PAGE;
  return state.items.slice(start, start + ITEMS_PER_PAGE);
}
function getTotalPages() {
  return Math.ceil(state.totalItems / ITEMS_PER_PAGE) || 1;
}
function updatePagination() {
  const totalPages = getTotalPages();
  $('#pageInfo').textContent = `Trang ${state.currentPage}/${totalPages}`;
  $('#btnPrev').disabled = state.currentPage === 1;
  $('#btnNext').disabled = state.currentPage === totalPages;
}

/* ==================== RENDER TABLE ==================== */
function renderTable(user) {
  const body = $('#contractsBody');
  const paginated = getPaginatedItems();
  if (!state.items.length) {
    body.innerHTML = `<tr><td colspan="13" class="text-muted">Không có dữ liệu</td></tr>`;
    return;
  }
  if (!paginated.length) {
    body.innerHTML = `<tr><td colspan="13" class="text-muted">Không có dữ liệu trang này</td></tr>`;
    return;
  }
  const isAdmin = user.role === 'admin';
  body.innerHTML = paginated
    .map((c) => {
      const sumPC = (c.phu_caps || []).reduce(
        (s, it) => s + Number(it.so_tien || 0),
        0
      );
      return `
      <tr>
        <td>${c.id}</td>
        <td>${esc(c.ho_ten || '')}</td>
        <td>${esc(c.so_hop_dong || '')}</td>
        <td>${esc(c.loai_hop_dong || '')}</td>
        <td>${esc(formatDate(c.ngay_ky))}</td>
        <td>${esc(formatDate(c.ngay_bat_dau))}</td>
        <td>${esc(formatDate(c.ngay_ket_thuc))}</td>
        <td>${Number(c.luong_thoa_thuan || 0).toLocaleString('vi-VN')} ₫</td>
        <td>${sumPC.toLocaleString('vi-VN')} ₫</td>
        <td>
          <span class="status-badge status-${
            c.trang_thai?.replace(/ /g, '-') || 'con_hieu_luc'
          }">
            ${esc(c.trang_thai || '')}
          </span>
        </td>
        <td>${esc((c.ghi_chu || '').substring(0, 30))}${
        c.ghi_chu?.length > 30 ? '...' : ''
      }</td>
        <td>${
          c.file_hop_dong
            ? `<a href="${esc(c.file_hop_dong)}" target="_blank">📄 Xem</a>`
            : ''
        }</td>
        <td class="action-cell">
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
      </tr>`;
    })
    .join('');
}

/* ==================== PHỤ CẤP ==================== */
function renderPhuCapList() {
  const container = $('#phuCapListContainer');
  if (!state.selectedPhuCaps.length) {
    container.innerHTML =
      '<p class="text-muted">Chưa có phụ cấp nào được thêm</p>';
    return;
  }
  container.innerHTML = state.selectedPhuCaps
    .map(
      (pc, idx) => `
      <div class="phu-cap-item">
        <span>${esc(pc.ten)} - ${Number(pc.so_tien).toLocaleString(
        'vi-VN'
      )} ₫</span>
        <button type="button" class="btn btn-sm btn-del" data-remove-pc="${idx}">✖</button>
      </div>`
    )
    .join('');
}
function populatePhuCapDropdown() {
  const select = $('#loai_phu_cap');
  select.innerHTML = '<option value="">-- Chọn loại phụ cấp --</option>';
  if (!state.phuCapLoaiList.length) {
    select.innerHTML +=
      '<option value="" disabled>Không có phụ cấp cố định</option>';
    return;
  }
  state.phuCapLoaiList.forEach((pc) => {
    select.innerHTML += `<option value="${pc.id}" data-mac-dinh="${
      pc.mac_dinh || 0
    }">${esc(pc.ten)}</option>`;
  });
}

/* ==================== MODAL TẠO/SỬA ==================== */
async function openModal(contract, user) {
  const modal = $('#contractModal');
  const form = $('#contractForm');
  state.editing = contract;
  state.selectedPhuCaps = [];
  $('#modalTitle').textContent = contract ? 'Sửa Hợp đồng' : 'Tạo Hợp đồng Mới';
  form.reset();

  if (!state.phuCapLoaiList.length) await loadPhuCapLoai();

  if (contract?.phu_caps?.length) {
    state.selectedPhuCaps = contract.phu_caps.map((pc) => ({
      loai_id: pc.loai_id,
      ten: pc.ten_phu_cap,
      so_tien: Number(pc.so_tien || 0),
    }));
  }

  populatePhuCapDropdown();
  renderPhuCapList();

  $('#loai_hop_dong').addEventListener('change', (e) => {
    $('#ngayKetThucGroup').style.display =
      e.target.value === 'Xác định thời hạn' ? 'block' : 'none';
    $('#ngay_ket_thuc').required = e.target.value === 'Xác định thời hạn';
  });

  const nvInput = $('#nhan_vien_id_input');
  const nvIdHidden = $('#nhan_vien_id');
  const nvDropdown = $('#nhanVienDropdown');
  nvInput.disabled = !!contract;

  nvInput.oninput = () => {
    const query = (nvInput.value || '').toLowerCase().trim();
    if (!query) {
      nvDropdown.innerHTML = '';
      nvDropdown.style.display = 'none';
      $('#luongCobanInfo').style.display = 'none';
      return;
    }
    const items = (state.nhanViens || [])
      .filter(
        (nv) =>
          (nv.ho_ten || '').toLowerCase().includes(query) ||
          String(nv.id || '').includes(query) ||
          (nv.ma_nhan_vien || '').toLowerCase().includes(query)
      )
      .slice(0, 10);
    if (!items.length) {
      nvDropdown.innerHTML =
        '<div style="padding:4px 8px; color:#888;">Không tìm thấy nhân viên phù hợp</div>';
      nvDropdown.style.display = 'block';
      return;
    }
    nvDropdown.innerHTML = items
      .map(
        (nv) =>
          `<div data-id="${nv.id}" data-name="${esc(
            nv.ho_ten || 'Không tên'
          )}">${esc(nv.ho_ten || 'Không tên')}${
            nv.ma_nhan_vien ? ` (${esc(nv.ma_nhan_vien)})` : ''
          }</div>`
      )
      .join('');
    nvDropdown.style.display = 'block';
  };

  nvDropdown.onclick = async (e) => {
    const div = e.target.closest('div[data-id]');
    if (!div) return;
    nvInput.value = div.dataset.name;
    nvIdHidden.value = div.dataset.id;
    nvDropdown.style.display = 'none';
    await loadSalaryInfo(div.dataset.id);
  };

  $('#loai_phu_cap').onchange = (e) => {
    const opt = e.target.selectedOptions[0];
    if (opt?.value)
      $('#so_tien_phu_cap').value = Number(opt.dataset.macDinh || 0);
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
    await loadSalaryInfo(contract.nhan_vien_id);
  } else {
    $('#loai_hop_dong').value = 'Thử việc';
    $('#ngay_ket_thuc').required = false;
  }

  $('#loai_hop_dong').dispatchEvent(new Event('change'));
  modal.showModal();
}

/* ==================== LƯƠNG CƠ BẢN ==================== */
async function loadSalaryInfo(nhanVienId) {
  try {
    const resp = await api(`/hop-dong/salary-info/${nhanVienId}`, {
      auth: true,
    });
    if (resp?.error) return;
    const luongCoban = Number(resp.muc_luong_co_ban || 0);
    $('#luongCobanInfo').style.display = 'block';
    $('#luongCobanValue').textContent =
      luongCoban.toLocaleString('vi-VN') + ' ₫';
    const luongInput = $('#luong_thoa_thuan');
    if (!luongInput.value || Number(luongInput.value) === 0)
      luongInput.value = luongCoban;
  } catch (e) {
    console.error('Error loading salary info:', e);
  }
}

/* ==================== PHỤ CẤP: THÊM/XÓA ==================== */
function addPhuCap() {
  const loaiSelect = $('#loai_phu_cap');
  const soTienInput = $('#so_tien_phu_cap');
  const loaiId = Number(loaiSelect.value);
  const soTien = Number(soTienInput.value);
  if (!loaiId || soTien <= 0)
    return alert('Vui lòng chọn loại phụ cấp và nhập số tiền hợp lệ');
  if (state.selectedPhuCaps.find((pc) => pc.loai_id === loaiId))
    return alert('Loại phụ cấp này đã được thêm');

  state.selectedPhuCaps.push({
    loai_id: loaiId,
    ten: loaiSelect.selectedOptions[0].text,
    so_tien: soTien,
  });
  renderPhuCapList();
  loaiSelect.value = '';
  soTienInput.value = '';
}
function closeModal() {
  $('#contractModal').close();
  state.editing = null;
  state.selectedPhuCaps = [];
}

/* ==================== SUBMIT ==================== */
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
  formData.append('luong_thoa_thuan', $('#luong_thoa_thuan').value || '0');
  formData.append('trang_thai', $('#trang_thai').value);
  formData.append('ghi_chu', $('#ghi_chu').value);

  if ($('#loai_hop_dong').value === 'Xác định thời hạn') {
    formData.append('ngay_ket_thuc', $('#ngay_ket_thuc').value);
  }

  const fileInput = $('#file_hop_dong');
  if (fileInput.files.length > 0)
    formData.append('file_hop_dong', fileInput.files[0]);

  formData.append('phu_caps', JSON.stringify(state.selectedPhuCaps));

  state.saving = true;
  $('#btnSave').textContent = 'Đang lưu...';
  $('#btnSave').disabled = true;

  try {
    const resp = await api(url, { method, auth: true, body: formData });
    if (resp?.error) return alert(`Lỗi: ${resp.error}`);
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
  const actionText = state.editing ? 'Sửa' : 'Tạo mới';
  if (confirm(`Bạn có chắc chắn muốn ${actionText} hợp đồng này không?`))
    handleSubmit(user);
}

/* ==================== VIEW MODAL ==================== */
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
      </tr>`
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
      contract.trang_thai?.replace(/ /g, '-') || 'con_hieu_luc'
    }">${contract.trang_thai}</span>`,
    'Ghi chú': esc(contract.ghi_chu) || 'Không có',
    'Tài liệu': contract.file_hop_dong
      ? `<a href="${esc(
          contract.file_hop_dong
        )}" target="_blank" class="btn-sm btn-link">Tải về</a>`
      : 'Không có',
  };

  const sumPC = (contract.phu_caps || []).reduce(
    (s, it) => s + Number(it.so_tien || 0),
    0
  );
  content.innerHTML = `
    <table class="detail-table"><tbody>
      ${Object.entries(data)
        .map(
          ([label, value]) =>
            `<tr class="detail-row"><td class="detail-label">${label}</td><td class="detail-value">${value}</td></tr>`
        )
        .join('')}
      <tr class="detail-row header-row">
        <td colspan="2" class="detail-label" style="font-weight: bold; padding-top: 15px;">
          Phụ cấp chi tiết (Tổng: ${sumPC.toLocaleString('vi-VN')} ₫):
        </td>
      </tr>
      <tr><td colspan="2" style="padding:0;">
        <table class="nested-table"><tbody>
          ${
            phuCapsHtml ||
            '<tr><td colspan="2" style="text-align:center; font-style:italic; border:none;">Không có phụ cấp chi tiết</td></tr>'
          }
        </tbody></table>
      </td></tr>
    </tbody></table>`;
  modal.showModal();
}

/* ==================== BIND EVENTS + INIT ==================== */
function bindEvents(user) {
  $('#btnCancel').addEventListener('click', closeModal);
  $('#contractForm').addEventListener('submit', (e) => {
    e.preventDefault();
    showConfirm(user);
  });
  $('#btnAddPhuCap').addEventListener('click', addPhuCap);

  $('#phuCapListContainer').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-pc]');
    if (!btn) return;
    state.selectedPhuCaps.splice(Number(btn.dataset.removePc), 1);
    renderPhuCapList();
  });

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

  $('#contractsBody').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const ct = state.items.find((c) => String(c.id) === String(id));

    if (action === 'view' && ct) return openViewModal(ct);
    if (action === 'edit' && user.role === 'admin' && ct)
      return openModal(ct, user);
    if (action === 'del' && user.role === 'admin') {
      if (!confirm(`Xoá hợp đồng #${id}?`)) return;
      await api(`/hop-dong/${id}`, { method: 'DELETE', auth: true });
      await fetchList(user);
    }
  });

  $('#btnPrev').addEventListener('click', () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      renderTable(user);
      updatePagination();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
  $('#btnNext').addEventListener('click', () => {
    const totalPages = getTotalPages();
    if (state.currentPage < totalPages) {
      state.currentPage++;
      renderTable(user);
      updatePagination();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  $('#nut-dong-modal').addEventListener('click', () => $('#viewModal').close());
}

async function init() {
  requireAuthOrRedirect('./dang-nhap.html');
  const user = getUser();
  if (!user) return;
  await loadPermissions();
  await loadNhanVienList();
  await loadPhuCapLoai();
  await fetchList(user);
  bindEvents(user);
}
init();
