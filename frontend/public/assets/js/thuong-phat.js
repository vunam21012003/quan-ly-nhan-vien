// assets/js/thuong-phat.js
import { api } from './api.js';

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

// ===== PHÂN QUYỀN FRONTEND =====
const USER = JSON.parse(localStorage.getItem('hr_user') || '{}');
const ROLE = (USER?.role || 'employee').toLowerCase();
const IS_ADMIN = ROLE === 'admin';
const IS_MANAGER = ROLE === 'manager';
const IS_EMPLOYEE = ROLE === 'employee';
const IS_ACC_MANAGER = USER?.isAccountingManager === true;

// ===== STATE PHÂN TRANG =====
const stTP = {
  page: 1,
  limit: 10,
  total: 0,
  items: [],
};

const money = (v) => Number(v ?? 0).toLocaleString('vi-VN');
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('vi-VN') : '');

const now = new Date();
const currentMonth = (now.getMonth() + 1).toString();
const currentYear = now.getFullYear().toString();
// ==== STATE CHUNG ====
const st = {
  nhanVienList: [],
  phongBanList: [],
  selectedNhanVienId: null,
  filters: {
    thang: currentMonth,
    nam: currentYear,
    nhan_vien_id: '',
    phong_ban_id: '',
    loai: '',
  },
};

// ======================= LẤY DỮ LIỆU NHÂN VIÊN =======================
async function fetchNhanVienList() {
  try {
    const res = await api('/nhan-vien?limit=1000');
    st.nhanVienList = res?.data?.items || res?.items || [];
  } catch (e) {
    console.error('Lỗi tải nhân viên:', e);
    st.nhanVienList = [];
  }
}

// ======================= TYPEAHEAD NHÂN VIÊN =======================
function setupNhanVienTypeahead() {
  // Admin và employee không dùng khối nhân viên
  if (IS_ADMIN || IS_EMPLOYEE) return;
  if ($('#tp-nv-search')) return;

  const placeholder = $('#tp-nv-typeahead-placeholder');
  if (!placeholder) return;

  const wrap = document.createElement('span');
  wrap.id = 'tp-search-wrap';
  wrap.style.position = 'relative';
  wrap.style.marginRight = '8px';
  wrap.innerHTML = `
    <input id="tp-nv-search" placeholder="Tìm nhân viên (Tên/ID)" style="width:220px" autocomplete="off"/>
    <div id="tp-nv-dropdown" style="display:none;position:absolute;left:0;right:0;top:34px;background:#fff;border:1px solid #ccc;border-radius:6px;max-height:220px;overflow:auto;z-index:1000"></div>
  `;

  const chip = document.createElement('span');
  chip.id = 'tp-nv-chip';
  chip.style.display = 'none';
  chip.style.marginRight = '8px';
  chip.style.background = '#eef5ff';
  chip.style.border = '1px solid #b6d3ff';
  chip.style.padding = '4px 8px';
  chip.style.borderRadius = '16px';
  chip.innerHTML = `<span id="tp-nv-chip-text"></span>
    <button id="tp-nv-chip-clear" type="button" style="margin-left:6px;border:none;background:transparent;cursor:pointer">❌</button>`;

  placeholder.appendChild(wrap);
  placeholder.appendChild(chip);

  const input = $('#tp-nv-search');
  const list = $('#tp-nv-dropdown');

  function filterNV(q) {
    const kw = q.trim().toLowerCase();
    if (!kw) return st.nhanVienList.slice(0, 30);
    return st.nhanVienList
      .filter(
        (nv) =>
          String(nv.id).includes(kw) ||
          (nv.ho_ten || '').toLowerCase().includes(kw)
      )
      .slice(0, 50);
  }

  function renderList(items) {
    if (!items.length) {
      list.innerHTML = `<div style="padding:6px 10px;color:#888">Không tìm thấy</div>`;
    } else {
      list.innerHTML = items
        .map(
          (nv) =>
            `<div data-id="${nv.id}" style="padding:6px 10px;cursor:pointer">#${
              nv.id
            } — ${esc(nv.ho_ten)}</div>`
        )
        .join('');
    }
    list.style.display = 'block';
  }

  input.addEventListener('input', () => renderList(filterNV(input.value)));
  input.addEventListener('focus', () => renderList(filterNV(input.value)));

  list.addEventListener('click', (e) => {
    const item = e.target.closest('[data-id]');
    if (!item) return;
    st.selectedNhanVienId = Number(item.dataset.id);
    st.filters.nhan_vien_id = st.selectedNhanVienId;

    const nv = st.nhanVienList.find((x) => x.id === st.selectedNhanVienId);
    $('#tp-nv-chip-text').textContent = nv
      ? `${nv.ho_ten} (#${nv.id})`
      : `#${st.selectedNhanVienId}`;
    $('#tp-nv-chip').style.display = 'inline-flex';
    $('#tp-search-wrap').style.display = 'none';
    list.style.display = 'none';
  });

  $('#tp-nv-chip-clear').addEventListener('click', () => {
    st.selectedNhanVienId = null;
    st.filters.nhan_vien_id = '';
    $('#tp-nv-chip').style.display = 'none';
    $('#tp-search-wrap').style.display = 'inline-block';
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) {
      list.style.display = 'none';
    }
  });
}

// ======================= LOAD PHÒNG BAN =======================
async function loadPhongBan() {
  let sel = null;

  // Chọn đúng ô select theo role
  if (IS_ADMIN) {
    sel = document.getElementById('tp-phong-ban');
  } else if (IS_MANAGER) {
    sel = document.getElementById('tp-phong-ban-A');
  } else if (IS_EMPLOYEE) {
    sel = document.getElementById('tp-phong-ban');
  }

  if (!sel) return;

  try {
    const res = await api('/cham-cong/phong-ban/list');
    let list = res?.items || res?.data?.items || [];

    // ---------- EMPLOYEE ----------
    if (IS_EMPLOYEE && USER?.phong_ban_id) {
      list = list.filter((x) => x.id === USER.phong_ban_id);
    }

    // ---------- MANAGER ----------
    if (IS_MANAGER) {
      if (
        Array.isArray(USER.managedDepartmentIds) &&
        USER.managedDepartmentIds.length > 0
      ) {
        list = list.filter((x) => USER.managedDepartmentIds.includes(x.id));
      } else {
        list = [];
      }
    }

    // ---------- ADMIN ----------
    // Không filter gì cả — giữ toàn bộ list

    // Render ra đúng select
    sel.innerHTML =
      `<option value="">-- Chọn phòng ban --</option>` +
      list
        .map((x) => `<option value="${x.id}">${esc(x.ten_phong_ban)}</option>`)
        .join('');
  } catch (e) {
    console.warn('Không tải được phòng ban', e);
  }

  // ---------- Employee lock ----------
  if (IS_EMPLOYEE && USER?.phong_ban_id) {
    sel.value = USER.phong_ban_id;
    sel.disabled = true;
  }
}

// ======================= RENDER BẢNG =======================
function renderThuongPhatTable() {
  // 1. Tính toán phân trang (cắt mảng items)
  const start = (stTP.page - 1) * stTP.limit;
  const end = start + stTP.limit;
  const rows = stTP.items.slice(start, end);

  // 2. Render HTML vào tbody
  $('#tbody-tp').innerHTML = rows.length
    ? rows
        .map((x) => {
          // ============================================================
          // 🛡️ LOGIC PHÂN QUYỀN NÚT XÓA
          // ============================================================
          let showDelete = false;

          if (IS_ADMIN || IS_ACC_MANAGER) {
            showDelete = true;
          } else if (IS_MANAGER) {
            const isCaNhan = !!x.ho_ten;

            if (isCaNhan) {
              showDelete = true;
            } else {
              showDelete = false;
            }
          }

          return `
            <tr>
              <td>${x.id}</td>
              <td>${esc(x.ho_ten ?? '')}</td>
              <td>${esc(x.loai)}</td>
              <td>${money(x.so_tien)}</td>
              <td>${esc(x.ly_do ?? '')}</td>
              <td>${fmtDate(x.ngay_tao)}</td>
              <td>${esc(x.nguoi_tao ?? '')}</td>
              <td>${esc(x.ten_phong_ban ?? '')}</td>
              <td style="text-align: center;">
                ${
                  showDelete
                    ? `<button class="page-btn" data-act="del" data-id="${x.id}" title="Xóa">🗑️</button>`
                    : ''
                }
              </td>
            </tr>
          `;
        })
        .join('')
    : `<tr><td colspan="9" class="text-muted">Không có dữ liệu</td></tr>`;

  stTP.total = stTP.items.length;
  const totalPages = Math.max(1, Math.ceil(stTP.total / stTP.limit));
  $('#tp-pageInfo').textContent = `Trang ${stTP.page}/${totalPages}`;
  // Disable nút nếu ở trang đầu hoặc trang cuối
  $('#tp-prev').disabled = stTP.page <= 1;
  $('#tp-next').disabled = stTP.page >= totalPages;
}

// ======================= FETCH LIST =======================
async function fetchList() {
  try {
    if (IS_EMPLOYEE && USER?.phong_ban_id) {
      st.filters.phong_ban_id = USER.phong_ban_id;
    }

    const { thang, nam, phong_ban_id, loai } = st.filters;
    const realNV = st.selectedNhanVienId || st.filters.nhan_vien_id;

    const q = new URLSearchParams();
    if (thang) q.append('thang', thang);
    if (nam) q.append('nam', nam);
    if (realNV) q.append('nhan_vien_id', realNV);
    if (phong_ban_id) q.append('phong_ban_id', phong_ban_id);
    if (loai) q.append('loai', loai);

    const res = await api(`/thuong-phat?${q.toString()}`);
    const rows = res?.items || res?.data?.items || [];
    stTP.items = rows;
    stTP.page = 1;
    renderThuongPhatTable();
  } catch (e) {
    console.error('Lỗi tải thưởng phạt:', e);
    $(
      '#tbody-tp'
    ).innerHTML = `<tr><td colspan="9" class="text-danger">Lỗi server</td></tr>`;
  }
}

// ======================= THÊM CHO NHÂN VIÊN =======================
async function addTPForNhanVien() {
  try {
    if (IS_ADMIN) {
      alert('Admin không được thưởng/phạt trực tiếp từng nhân viên');
      return;
    }
    if (IS_EMPLOYEE) {
      alert('Nhân viên không thể thêm thưởng/phạt');
      return;
    }

    const nhan_vien_id = st.selectedNhanVienId || null;
    if (!nhan_vien_id) {
      alert('Vui lòng chọn nhân viên');
      return;
    }

    const selectedNV = st.nhanVienList.find((nv) => nv.id === nhan_vien_id);
    const phong_ban_id = selectedNV?.phong_ban_id || null;
    const loai = $('#tp-loai-nv')?.value;
    const so_tien = Number($('#tp-so-tien-nv')?.value || 0);
    const ly_do = $('#tp-ly-do-nv')?.value || '';
    const thang = $('#tp-thang-nv')?.value;
    const nam = $('#tp-nam-nv')?.value;

    if (!thang || !nam) {
      alert('Vui lòng chọn tháng và năm');
      return;
    }
    if (!so_tien) {
      alert('Số tiền không hợp lệ');
      return;
    }

    await api('/thuong-phat', {
      method: 'POST',
      body: {
        nhan_vien_id,
        phong_ban_id,
        loai,
        so_tien,
        ly_do,
        thang,
        nam,
      },
    });

    $('#tp-so-tien-nv').value = '';
    $('#tp-ly-do-nv').value = '';

    st.filters.nhan_vien_id = nhan_vien_id;
    // THÊM 2 DÒNG NÀY:
    st.filters.thang = thang;
    st.filters.nam = nam;
    await fetchList();
  } catch (err) {
    alert(err?.message || 'Không thể thêm thưởng/phạt nhân viên');
    console.error(err);
  }
}

// ======================= THÊM CHO PHÒNG BAN =======================
async function addTPForPhongBan() {
  try {
    if (IS_EMPLOYEE) {
      alert('Nhân viên không thể thêm thưởng/phạt');
      return;
    }

    const pbSelect = $('#tp-phong-ban');
    const phong_ban_id =
      pbSelect && pbSelect.value ? Number(pbSelect.value) : null;
    if (!phong_ban_id) {
      alert('Vui lòng chọn phòng ban');
      return;
    }

    const loai = $('#tp-loai-pb')?.value;
    const so_tien = Number($('#tp-so-tien-pb')?.value || 0);
    const ly_do = $('#tp-ly-do-pb')?.value || '';
    const thang = $('#tp-thang-pb')?.value;
    const nam = $('#tp-nam-pb')?.value;

    if (!thang || !nam) {
      alert('Vui lòng chọn tháng và năm');
      return;
    }
    if (!so_tien) {
      alert('Số tiền không hợp lệ');
      return;
    }

    await api('/thuong-phat', {
      method: 'POST',
      body: {
        nhan_vien_id: null,
        phong_ban_id,
        loai,
        so_tien,
        ly_do,
        thang,
        nam,
      },
    });

    $('#tp-so-tien-pb').value = '';
    $('#tp-ly-do-pb').value = '';

    st.filters.phong_ban_id = phong_ban_id;
    await fetchList();
  } catch (err) {
    alert(err?.message || 'Không thể thêm thưởng/phạt phòng ban');
    console.error(err);
  }
}

// ======================= XOÁ =======================
async function delTP(id) {
  if (!confirm('Xoá bản ghi này?')) return;
  try {
    await api(`/thuong-phat/${id}`, { method: 'DELETE' });
    await fetchList();
  } catch (err) {
    alert(err?.message || 'Không thể xoá bản ghi');
    console.error(err);
  }
}

// ======================= XUẤT EXCEL =======================
function setupExportExcel() {
  const btnExport = $('#btn-export-tp');
  if (!btnExport) return;

  // Ẩn nút cho nhân viên
  if (!(IS_ADMIN || IS_MANAGER)) {
    btnExport.style.display = 'none';
    return;
  } else {
    btnExport.style.display = 'inline-block';
  }

  btnExport.addEventListener('click', async () => {
    const { thang, nam, nhan_vien_id, phong_ban_id } = st.filters;
    const q = new URLSearchParams();
    if (thang) q.append('thang', thang);
    if (nam) q.append('nam', nam);
    if (nhan_vien_id) q.append('nhan_vien_id', nhan_vien_id);
    if (phong_ban_id) q.append('phong_ban_id', phong_ban_id);

    try {
      const token = localStorage.getItem('hr_token');
      if (!token) return alert('Bạn chưa đăng nhập');

      // Gọi API xuất Excel
      const res = await fetch(`/thuong-phat/export-excel?${q.toString()}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        return alert(err?.error || 'Xuất Excel thất bại');
      }

      // Tải file Excel
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Thuong_Phat_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Lỗi khi xuất Excel');
    }
  });
}

// Gọi hàm sau khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  setupExportExcel();
});

// ======================= KHỞI TẠO CƠ BẢN =======================
document.addEventListener('DOMContentLoaded', () => {
  const tpTab = $('#thuong-phat-tab');
  if (!tpTab) return;

  // Ẩn/hiện block theo role
  const blockNV = $('#tp-block-nhanvien');
  const blockPB = $('#tp-block-phongban');

  if (IS_ADMIN) {
    // Admin chỉ dùng block PB
    blockNV && (blockNV.style.display = 'none');
    blockPB && (blockPB.style.display = 'block');
  } else if (IS_MANAGER) {
    // Manager (kể cả kế toán): dùng block NV
    blockNV && (blockNV.style.display = 'block');
    blockPB && (blockPB.style.display = 'none');
  } else if (IS_EMPLOYEE) {
    // Nhân viên: không thêm, chỉ xem bảng
    blockNV && (blockNV.style.display = 'none');
    blockPB && (blockPB.style.display = 'none');
  }

  // Tạo options tháng/năm cho cả 2 khối
  const now = new Date();
  const currentYear = now.getFullYear();

  const monthIds = ['tp-thang-nv', 'tp-thang-pb'];
  monthIds.forEach((id) => {
    const sel = $('#' + id);
    if (sel && sel.options.length <= 1) {
      for (let i = 1; i <= 12; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i;
        sel.appendChild(opt);
      }
      sel.value = currentMonth;
    }
  });

  const yearIds = ['tp-nam-nv', 'tp-nam-pb'];
  yearIds.forEach((id) => {
    const sel = $('#' + id);
    if (sel && sel.options.length <= 1) {
      for (let y = Number(currentYear) - 1; y <= Number(currentYear) + 2; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        sel.appendChild(opt);
      }
      sel.value = currentYear;
    }
  });

  // PHÂN TRANG
  $('#tp-prev')?.addEventListener('click', () => {
    if (stTP.page > 1) {
      stTP.page--;
      renderThuongPhatTable();
    }
  });
  $('#tp-next')?.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(stTP.total / stTP.limit));
    if (stTP.page < totalPages) {
      stTP.page++;
      renderThuongPhatTable();
    }
  });
});

// ======================= KHỞI CHẠY CHÍNH =======================
document.addEventListener('DOMContentLoaded', async () => {
  if (!$('#thuong-phat-tab')) return;

  await fetchNhanVienList();
  await loadPhongBan();
  setupNhanVienTypeahead();

  $('#btn-tp-add-nv')?.addEventListener('click', addTPForNhanVien);
  $('#btn-tp-add-pb')?.addEventListener('click', addTPForPhongBan);

  $('#btn-filter-nv')?.addEventListener('click', async () => {
    const thang = $('#tp-thang-nv')?.value;
    const nam = $('#tp-nam-nv')?.value;

    st.filters.thang = thang;
    st.filters.nam = nam;
    st.filters.loai = $('#tp-loai-nv')?.value;
    await fetchList();
  });

  $('#btn-filter-pb')?.addEventListener('click', async () => {
    const thang = $('#tp-thang-pb')?.value;
    const nam = $('#tp-nam-pb')?.value;
    const phong_ban_id = $('#tp-phong-ban')?.value || '';
    st.filters.thang = thang;
    st.filters.nam = nam;
    st.filters.phong_ban_id = phong_ban_id;
    st.filters.loai = $('#tp-loai-pb')?.value;
    st.filters.nhan_vien_id = '';
    await fetchList();
  });

  $('#tbody-tp')?.addEventListener('click', (e) => {
    const btn = e.target.closest("button[data-act='del']");
    if (btn) delTP(btn.dataset.id);
  });

  await fetchList();
});
