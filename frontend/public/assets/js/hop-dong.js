import { api, getUser, requireAuthOrRedirect, logout } from './api.js';

const state = {
  items: [],
  editing: null,
  saving: false,
  nhanViens: [],
};

function $(sel, root = document) {
  return root.querySelector(sel);
}
function esc(s) {
  return (s ?? '').toString().replace(
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
}
function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString('vi-VN');
}
function unwrap(resp) {
  if (!resp) return [];
  if (Array.isArray(resp)) return resp;
  if (Array.isArray(resp.data)) return resp.data;
  return [];
}

// ===== Render bảng =====
function renderTable(user) {
  const body = $('#contractsBody');
  if (!state.items.length) {
    body.innerHTML = `<tr><td colspan="15" class="text-muted">Không có dữ liệu</td></tr>`;
    return;
  }
  body.innerHTML = state.items
    .map(
      (c) => `
    <tr>
      <td>${esc(c.id)}</td>
      <td>${esc(c.ho_ten || c.nhan_vien_id)}</td>
      <td>${esc(c.so_hop_dong || '')}</td>
      <td>${esc(c.loai_hop_dong || '')}</td>
      <td>${esc(formatDate(c.ngay_ky))}</td>
      <td>${esc(formatDate(c.ngay_bat_dau))}</td>
      <td>${esc(formatDate(c.ngay_ket_thuc))}</td>
      <td>${esc(Number(c.luong_thoa_thuan ?? 0).toLocaleString('vi-VN'))}</td>
      <td>${esc(Number(c.phu_cap_co_dinh ?? 0).toLocaleString('vi-VN'))}</td>
      <td>${esc(Number(c.phu_cap_tham_nien ?? 0).toLocaleString('vi-VN'))}</td>
      <td>${esc(Number(c.phu_cap_nang_luc ?? 0).toLocaleString('vi-VN'))}</td>
      <td>${esc(
        Number(c.phu_cap_trach_nhiem ?? 0).toLocaleString('vi-VN')
      )}</td>
      <td>${esc(c.trang_thai || '')}</td>
      <td>${esc(c.ghi_chu || '')}</td>
      <td>${
        c.file_hop_dong
          ? `<a href="${esc(c.file_hop_dong)}" target="_blank">📄 Xem</a>`
          : ''
      }</td>
      <td>
        ${
          user.role === 'admin' || user.role === 'manager'
            ? `<button class="btn btn-sm btn-edit" data-action="edit" data-id="${c.id}">✏️</button>`
            : ''
        }
        ${
          user.role === 'admin'
            ? `<button class="btn btn-sm btn-del" data-action="del" data-id="${c.id}">🗑️</button>`
            : ''
        }
      </td>
    </tr>
  `
    )
    .join('');
}

// ===== Dropdown nhân viên =====
async function loadNhanVienList() {
  try {
    const res = await api('/nhan-vien?limit=1000');
    const data = res?.data?.items || res.items || [];
    state.nhanViens = data;

    const input = $('#nhan_vien_search');
    const dropdown = $('#nhan_vien_dropdown');

    function showList(filter = '') {
      const keyword = filter.toLowerCase().trim();
      const filtered = !keyword
        ? data
        : data.filter(
            (nv) =>
              (nv.ho_ten || '').toLowerCase().includes(keyword) ||
              String(nv.id).includes(keyword)
          );

      dropdown.innerHTML = filtered.length
        ? filtered
            .map(
              (nv) =>
                `<div data-id="${nv.id}">${nv.id} - ${esc(
                  nv.ho_ten || ''
                )}</div>`
            )
            .join('')
        : '<div class="text-muted" style="padding:6px;">Không tìm thấy</div>';
      dropdown.style.display = 'block';
    }
    function hideList() {
      dropdown.style.display = 'none';
    }

    input.addEventListener('focus', () => showList(input.value));
    input.addEventListener('input', (e) => showList(e.target.value));

    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('div[data-id]');
      if (!item) return;
      input.dataset.selectedId = item.dataset.id;
      input.value = item.textContent.replace(/^\d+\s*-\s*/, '');
      hideList();
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && e.target !== input) hideList();
    });

    input.getSelectedId = () => input.dataset.selectedId || null;
  } catch (err) {
    console.error('Không tải được danh sách nhân viên', err);
  }
}

// ===== Gợi ý lương theo chức vụ (placeholder) =====
async function autoSuggestSalary() {
  const input = $('#nhan_vien_search');
  input.addEventListener('change', async () => {
    const nhanVienId = input.getSelectedId?.();
    if (!nhanVienId) return;

    try {
      const nv = await api(`/nhan-vien/${nhanVienId}`, { auth: true });
      if (!nv || !nv.chuc_vu_id) return;
      const chucVu = await api(`/chuc-vu/${nv.chuc_vu_id}`, { auth: true });
      if (chucVu?.muc_luong_co_ban) {
        $('#luong_thoa_thuan').placeholder = `${Number(
          chucVu.muc_luong_co_ban
        ).toLocaleString('vi-VN')} ₫ (theo chức vụ)`;
      }
    } catch (err) {
      console.error('Không thể lấy mức lương cơ bản:', err);
    }
  });
}

// ===== Danh sách hợp đồng =====
async function fetchList(user) {
  const url = user.role === 'employee' ? '/hop-dong?mine=1' : '/hop-dong';
  const resp = await api(url, { auth: true });
  state.items = unwrap(resp);
  renderTable(user);
}

// ===== Mở modal =====
function openModal(contract, user) {
  state.editing = contract || null;
  $('#modalTitle').textContent = contract
    ? `Sửa hợp đồng #${contract.id}`
    : 'Thêm hợp đồng';

  $('#contractId').value = contract?.id || '';
  const nvInput = $('#nhan_vien_search');
  if (nvInput) {
    nvInput.value = contract?.ho_ten || '';
    nvInput.dataset.selectedId = contract?.nhan_vien_id || '';
  }

  $('#so_hop_dong').value = contract?.so_hop_dong || '';
  $('#loai_hop_dong').value = contract?.loai_hop_dong || '';
  $('#ngay_ky').value = contract?.ngay_ky
    ? new Date(contract.ngay_ky).toISOString().split('T')[0]
    : '';
  $('#ngay_bat_dau').value = contract?.ngay_bat_dau
    ? new Date(contract.ngay_bat_dau).toISOString().split('T')[0]
    : '';
  $('#ngay_ket_thuc').value = contract?.ngay_ket_thuc
    ? new Date(contract.ngay_ket_thuc).toISOString().split('T')[0]
    : '';
  $('#luong_thoa_thuan').value = contract?.luong_thoa_thuan || '';

  $('#phu_cap_co_dinh').value = contract?.phu_cap_co_dinh || '';
  $('#phu_cap_tham_nien').value = contract?.phu_cap_tham_nien || '';
  $('#phu_cap_nang_luc').value = contract?.phu_cap_nang_luc || '';
  $('#phu_cap_trach_nhiem').value = contract?.phu_cap_trach_nhiem || '';

  $('#trang_thai').value = contract?.trang_thai || 'con_hieu_luc';
  $('#ghi_chu').value = contract?.ghi_chu || '';

  document
    .querySelectorAll('.admin-only')
    .forEach(
      (el) => (el.style.display = user.role === 'admin' ? 'block' : 'none')
    );

  $('#contractModal').showModal();
}
function closeModal() {
  $('#contractModal').close();
}

// ===== Hiển thị form xác nhận =====
function showConfirmModal(user) {
  const modal = $('#confirmModal');
  const content = $('#confirmContent');

  const data = {
    'Nhân viên': $('#nhan_vien_search').value,
    'Số hợp đồng': $('#so_hop_dong').value,
    'Loại hợp đồng': $('#loai_hop_dong').value,
    'Ngày ký': $('#ngay_ky').value,
    'Ngày bắt đầu': $('#ngay_bat_dau').value,
    'Ngày kết thúc': $('#ngay_ket_thuc').value,
    'Lương thỏa thuận':
      $('#luong_thoa_thuan').value || $('#luong_thoa_thuan').placeholder,
    'Phụ cấp cố định': $('#phu_cap_co_dinh').value,
    'Phụ cấp thâm niên': $('#phu_cap_tham_nien').value,
    'Phụ cấp năng lực': $('#phu_cap_nang_luc').value,
    'Phụ cấp trách nhiệm': $('#phu_cap_trach_nhiem').value,
    'Trạng thái': $('#trang_thai').value,
    'Ghi chú': $('#ghi_chu').value,
  };

  content.innerHTML = `
    <table class="table" style="width:100%"><tbody>
      ${Object.entries(data)
        .map(
          ([label, value]) => `
        <tr><td style="width:40%;font-weight:bold;">${label}</td><td>${esc(
            value || ''
          )}</td></tr>
      `
        )
        .join('')}
    </tbody></table>
  `;

  modal.showModal();
  $('#btnConfirmCancel').onclick = () => modal.close();
  $('#btnConfirmOk').onclick = async () => {
    modal.close();
    await saveContract(user);
  };
}

// ===== Lưu hợp đồng =====
async function saveContract(user) {
  if (state.saving) return;
  state.saving = true;
  const btnSave = $('#btnSave');
  btnSave.disabled = true;
  btnSave.textContent = 'Đang lưu...';

  const id = $('#contractId').value;
  const formData = new FormData();
  formData.append('so_hop_dong', $('#so_hop_dong').value || '');
  formData.append('phu_cap_co_dinh', $('#phu_cap_co_dinh').value || '');
  formData.append('phu_cap_tham_nien', $('#phu_cap_tham_nien').value || '');
  formData.append('phu_cap_nang_luc', $('#phu_cap_nang_luc').value || '');
  formData.append('phu_cap_trach_nhiem', $('#phu_cap_trach_nhiem').value || '');
  formData.append('ghi_chu', $('#ghi_chu').value || '');
  formData.append('trang_thai', $('#trang_thai').value || '');

  const file = $('#file_hop_dong')?.files[0];
  if (file) formData.append('file_hop_dong', file);

  if (user.role === 'admin') {
    formData.append(
      'nhan_vien_id',
      $('#nhan_vien_search').getSelectedId?.() || ''
    );
    formData.append('loai_hop_dong', $('#loai_hop_dong').value || '');
    formData.append('ngay_ky', $('#ngay_ky').value || '');
    formData.append('ngay_bat_dau', $('#ngay_bat_dau').value || '');
    formData.append('ngay_ket_thuc', $('#ngay_ket_thuc').value || '');
    formData.append('luong_thoa_thuan', $('#luong_thoa_thuan').value || '');
  }

  try {
    if (id)
      await api(`/hop-dong/${id}`, {
        method: 'PUT',
        body: formData,
        auth: true,
        formData: true,
      });
    else
      await api(`/hop-dong`, {
        method: 'POST',
        body: formData,
        auth: true,
        formData: true,
      });
    closeModal();
    await fetchList(user);
  } catch (err) {
    alert(err?.message || 'Lưu thất bại');
  } finally {
    state.saving = false;
    btnSave.disabled = false;
    btnSave.textContent = 'Lưu';
  }
}

// ===== Bind sự kiện =====
function bindEvents(user) {
  $('#btnCancel').addEventListener('click', closeModal);
  $('#contractForm').addEventListener('submit', (e) => {
    e.preventDefault();
    showConfirmModal(user);
  });
  $('#btnAdd').addEventListener('click', () => openModal(null, user));

  $('#contractsBody').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const contract = state.items.find((c) => String(c.id) === String(id));
    if (action === 'edit') openModal(contract, user);
    if (action === 'del' && user.role === 'admin') {
      if (!confirm(`Xoá hợp đồng #${id}?`)) return;
      await api(`/hop-dong/${id}`, { method: 'DELETE', auth: true });
      await fetchList(user);
    }
  });
}

// ===== Khởi tạo =====
async function init() {
  requireAuthOrRedirect('./dang-nhap.html');
  const user = getUser();
  if (!user) return;

  if (user.role === 'admin') $('#btnAdd').classList.remove('hidden');
  else $('#actionsCol').textContent = 'Thao tác';

  await loadNhanVienList();
  await autoSuggestSalary();
  await fetchList(user);
  bindEvents(user);

  $('#user-badge').textContent = user.username || user.full_name || 'User';
  $('#logout-btn').addEventListener('click', () => {
    logout();
    window.location.href = './dang-nhap.html';
  });
  $('#y').textContent = new Date().getFullYear();
}

document.addEventListener('DOMContentLoaded', init);
