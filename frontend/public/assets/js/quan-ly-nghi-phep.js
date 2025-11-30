import { api, requireAuthOrRedirect, getUser, logout } from './api.js';

// Biến toàn cục
let currentUser = null;

// Gắn logout ra window
window.logout = logout;

// ============================================================
// 1. KHỞI TẠO & EVENT LISTENER
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  await requireAuthOrRedirect();
  currentUser = getUser();

  // Set năm hiện tại
  const yearSelect = document.getElementById('filterYear');
  if (yearSelect) yearSelect.value = new Date().getFullYear();

  loadDanhSach();

  // Đóng modal khi click ra ngoài vùng nội dung
  window.onclick = function (event) {
    if (event.target.classList.contains('modal')) {
      event.target.classList.remove('show');
    }
  };
});

// ============================================================
// 2. HÀM TẢI DỮ LIỆU
// ============================================================
window.loadDanhSach = async () => {
  const trangThai = document.getElementById('filterTrangThai').value;
  const year = document.getElementById('filterYear').value;

  try {
    const data = await api(
      `/don-nghi-phep?trang_thai=${trangThai}&year=${year}`
    );
    renderTable(data);
  } catch (err) {
    console.error(err);
    alert('Lỗi tải dữ liệu: ' + err.message);
  }
};

// ============================================================
// 3. RENDER BẢNG
// ============================================================
function renderTable(list) {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  if (!list || list.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="8" style="text-align:center; padding: 20px;">Không có dữ liệu</td></tr>';
    return;
  }

  list.forEach((item) => {
    const isManager =
      currentUser.role === 'admin' || currentUser.role === 'manager';
    const isMe = item.nhan_vien_id === currentUser.employeeId;

    // -- Trạng thái --
    let statusHtml = '';
    if (item.trang_thai === 'cho_duyet')
      statusHtml = '<span class="badge status-cho_duyet">Chờ duyệt</span>';
    else if (item.trang_thai === 'da_duyet')
      statusHtml = '<span class="badge status-da_duyet">Đã duyệt</span>';
    else if (item.trang_thai === 'tu_choi')
      statusHtml = '<span class="badge status-tu_choi">Từ chối</span>';
    else if (item.trang_thai === 'da_huy')
      statusHtml = '<span class="badge status-da_huy">Đã hủy</span>';

    // -- Thời gian --
    let timeDisplay = '';
    if (parseFloat(item.so_ngay) === 0.5) {
      timeDisplay = `<div>${formatDate(item.ngay_bat_dau)}</div>
                           <small class="text-muted">(${
                             item.buoi_nghi === 'sang' ? 'Sáng' : 'Chiều'
                           })</small>`;
    } else {
      timeDisplay = `<div>${formatDate(item.ngay_bat_dau)}</div>
                           <div class="text-muted">đến ${formatDate(
                             item.ngay_ket_thuc
                           )}</div>`;
    }

    // -- Nút hành động --
    let actions = '';
    // Sếp duyệt/từ chối
    if (isManager && item.trang_thai === 'cho_duyet') {
      actions += `
                <button class="btn btn-sm btn-success" onclick="duyetDon(${item.id})" title="Duyệt">✔</button>
                <button class="btn btn-sm btn-danger" onclick="openTuChoiModal(${item.id})" title="Từ chối">✘</button>
            `;
    }
    // Nhân viên hủy
    if (isMe && item.trang_thai === 'cho_duyet') {
      actions += `<button class="btn btn-sm btn-outline" onclick="huyDon(${item.id})">Hủy</button>`;
    }

    const row = `
          <tr>
            <td>
              <div class="text-bold">${item.ho_ten}</div>
              <div class="text-muted">${item.ten_chuc_vu || ''}</div>
            </td>
            <td><span class="badge badge-type">${mappingLoaiNghi(
              item.loai_nghi
            )}</span></td>
            <td>${timeDisplay}</td>
            <td class="text-bold" style="color: var(--primary-color)">${parseFloat(
              item.so_ngay
            )} ngày</td>
            <td>
              <div style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${
                item.ly_do
              }">${item.ly_do}</div>
              ${
                item.ly_do_tu_choi
                  ? `<div style="color:red; font-size:0.8rem; margin-top:4px;">*Lý do từ chối: ${item.ly_do_tu_choi}</div>`
                  : ''
              }
            </td>
            <td>
               <span style="background:#eee; padding:2px 6px; border-radius:4px; font-size:0.8rem;">
                 Đã nghỉ: <strong>${item.tong_nghi_phep_nam_nay || 0}</strong>
               </span>
            </td>
            <td>${statusHtml}</td>
            <td style="text-align: right;">${actions}</td>
          </tr>
        `;
    tbody.innerHTML += row;
  });
}

// Helper Functions
function mappingLoaiNghi(code) {
  const map = {
    phep_nam: 'Phép năm',
    om_dau: 'Ốm đau',
    khong_luong: 'Không lương',
    khac: 'Khác',
  };
  return map[code] || code;
}
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('vi-VN');
}

// ============================================================
// 4. QUẢN LÝ MODAL (MỞ/ĐÓNG)
// ============================================================
window.openModal = (modalId) => {
  document.getElementById(modalId).classList.add('show');
};
window.closeModal = (modalId) => {
  document.getElementById(modalId).classList.remove('show');
};

// ============================================================
// 5. LOGIC FORM TẠO ĐƠN
// ============================================================
window.toggleThoiGian = () => {
  const mode = document.querySelector(
    'input[name="option_thoi_gian"]:checked'
  ).value;
  const divKetThuc = document.getElementById('divNgayKetThuc');
  const divBuoi = document.getElementById('divBuoiNghi');

  if (mode === 'ca_ngay') {
    divKetThuc.classList.remove('d-none');
    divBuoi.classList.add('d-none');
  } else {
    divKetThuc.classList.add('d-none');
    divBuoi.classList.remove('d-none');
  }
};

window.submitDon = async () => {
  const form = document.getElementById('formTaoDon');
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());
  const mode = document.querySelector(
    'input[name="option_thoi_gian"]:checked'
  ).value;

  const payload = {
    loai_nghi: data.loai_nghi,
    ngay_bat_dau: data.ngay_bat_dau,
    ly_do: data.ly_do,
    buoi_nghi: 'ca_ngay',
    ngay_ket_thuc: data.ngay_bat_dau,
  };

  if (mode === 'ca_ngay') {
    payload.ngay_ket_thuc = data.ngay_ket_thuc || data.ngay_bat_dau;
  } else {
    payload.buoi_nghi = data.buoi_nghi;
  }

  try {
    await api('/don-nghi-phep', { method: 'POST', body: payload });
    alert('Gửi đơn thành công!');
    closeModal('modalTaoDon');
    form.reset();
    // Reset default state
    document.getElementById('radioCaNgay').checked = true;
    toggleThoiGian();
    loadDanhSach();
  } catch (err) {
    alert(err.message);
  }
};

// ============================================================
// 6. LOGIC XỬ LÝ ĐƠN
// ============================================================
window.duyetDon = async (id) => {
  if (!confirm('Duyệt đơn này? Chấm công sẽ được cập nhật tự động.')) return;
  try {
    await api(`/don-nghi-phep/${id}/approve`, { method: 'POST' });
    loadDanhSach();
  } catch (err) {
    alert(err.message);
  }
};

window.openTuChoiModal = (id) => {
  document.getElementById('hiddenRejectId').value = id;
  document.getElementById('txtLyDoTuChoi').value = '';
  openModal('modalTuChoi');
};

window.confirmTuChoi = async () => {
  const id = document.getElementById('hiddenRejectId').value;
  const lyDo = document.getElementById('txtLyDoTuChoi').value;
  if (!lyDo) {
    alert('Vui lòng nhập lý do');
    return;
  }

  try {
    await api(`/don-nghi-phep/${id}/reject`, {
      method: 'POST',
      body: { ly_do_tu_choi: lyDo },
    });
    closeModal('modalTuChoi');
    loadDanhSach();
  } catch (err) {
    alert(err.message);
  }
};

window.huyDon = async (id) => {
  if (!confirm('Hủy đơn xin nghỉ này?')) return;
  try {
    await api(`/don-nghi-phep/${id}/cancel`, { method: 'POST' });
    loadDanhSach();
  } catch (err) {
    alert(err.message);
  }
};
