// bao-cao-luong.js
import {
  api,
  getUser,
  getToken,
  clearAuth,
  requireAuthOrRedirect,
} from './api.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => r.querySelectorAll(s);
const money = (v) => (v == null ? 0 : Number(v)).toLocaleString('vi-VN');
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

//  HIỂN THỊ USER BADGE
function setUserBadge() {
  const b = $('#user-badge'),
    u = getUser();

  if (!b) return;

  if (!u) {
    b.className = 'badge badge-warn';
    b.textContent = 'Chưa đăng nhập';
    return;
  }

  const role = u.role ?? u.quyen ?? 'user';
  b.className = 'badge badge-ok';
  b.textContent = `User: ${u.username ?? u.ten_dang_nhap ?? ''} • ${role}`;
}

function buildQuery() {
  const qs = new URLSearchParams();

  // tháng
  const thang = $('#thang').value;
  if (thang) qs.append('thang', thang);

  // năm
  const nam = $('#nam').value;
  if (nam) qs.append('nam', nam);

  // phòng ban
  const pb = $('#phong_ban').value;
  if (pb) qs.append('phong_ban_id', pb);

  // người duyệt
  const nguoiDuyet = $('#nguoi_duyet').value;
  if (nguoiDuyet) qs.append('nguoi_duyet_id', nguoiDuyet);

  // từ khóa
  const keyword = $('#search').value.trim();
  if (keyword) qs.append('q', keyword);

  // trạng thái tab
  const activeTab = document.querySelector('.tab-btn.active')?.dataset.status;
  if (activeTab) qs.append('trang_thai', activeTab);

  return qs.toString();
}

function getRole() {
  const u = getUser();
  // Backend đang dùng: "admin" | "manager" | "employee"
  return u?.role || 'employee';
}

function isAccountingManager() {
  const u = getUser();
  // Nếu JWT có field này thì dùng, nếu chưa có thì luôn false (BE vẫn chặn)
  return !!u?.isAccountingManager;
}

// Chỉ admin + manager phòng kế toán được phép trả lương
function canPay() {
  const r = getRole();
  return r === 'admin' || (r === 'manager' && isAccountingManager());
}

// Chỉ admin + manager phòng kế toán được export
function canExport() {
  return canPay();
}

//  TẠO 10 KPI CHUẨN KẾ TOÁN
function renderCards(s) {
  const parts = [
    { label: 'P1 — Lương theo công', val: s.tong_co_ban },
    { label: 'P2 — Phụ cấp', val: s.tong_phu_cap },
    { label: 'P3 — Thưởng/Tăng ca', val: s.tong_thuong },
    {
      label: 'Tổng Lương Gross',
      val: s.tong_co_ban + s.tong_phu_cap + s.tong_thuong,
    },

    { label: 'BHXH', val: s.tong_bhxh ?? 0 },
    { label: 'BHYT', val: s.tong_bhyt ?? 0 },
    { label: 'BHTN', val: s.tong_bhtn ?? 0 },
    { label: 'Thuế TNCN', val: s.tong_thue ?? 0 },

    { label: 'Tổng chi NET', val: s.tong_chi },
    { label: 'Số nhân viên', val: s.so_nv },
  ];

  const max = Math.max(
    1,
    ...parts.map((p) => (typeof p.val === 'number' ? p.val : 0))
  );

  $('#cards').innerHTML = parts
    .map(
      (p) => `
      <div class="card card-kpi">
        <p class="kpi-title">${p.label}</p>
        <p class="kpi-value">${
          p.label === 'Số nhân viên' ? esc(p.val) : money(p.val)
        }</p>
        ${
          p.label === 'Số nhân viên'
            ? ''
            : `
            <div class="bar">
              <div style="width:${Math.round(
                ((Number(p.val) || 0) / max) * 100
              )}%"></div>
            </div>`
        }
      </div>
    `
    )
    .join('');
}

function statusBadge(st) {
  if (!st) return `<span class="badge-status badge-info">Không rõ</span>`;

  switch (st) {
    case 'da_thanh_toan':
      return `<span class="badge-status badge-ok">Đã trả</span>`;
    case 'cho_xu_ly':
      return `<span class="badge-status badge-warning">Chưa trả</span>`;
    case 'that_bai':
      return `<span class="badge-status badge-danger">Thất bại</span>`;
    case 'con_no':
      return `<span class="badge-status badge-warning">Còn nợ</span>`;
    default:
      return `<span class="badge-status badge-info">${st}</span>`;
  }
}

//  DÒNG DỮ LIỆU TRONG BẢNG (THÊM CỘT NGƯỜI DUYỆT)
function rowHtml(x) {
  const isEditable =
    canPay() &&
    (x.trang_thai_cuoi === 'cho_xu_ly' || x.trang_thai_cuoi === 'con_no');

  return `
    <tr>
      <td style="white-space:nowrap">
        <button class="page-btn"
          data-act="detail"
          data-id="${x.nhan_vien_id}"
          data-thang="${x.thang}"
          data-nam="${x.nam}">
          Xem
        </button>

        ${
          isEditable
            ? `<button class="page-btn btn-pay"
                data-act="pay"
                data-id="${x.nhan_vien_id}"
                data-thang="${x.thang}"
                data-nam="${x.nam}"
                data-conno="${x.con_no}">
                Trả
              </button>
              `
            : ``
        }
      </td>

      <td>${esc(x.nhan_vien_id)}</td>
      <td>${esc(x.ho_ten)}</td>
      <td>${esc(x.phong_ban)}</td>
      <td>${x.thang}/${x.nam}</td>

      <td style="text-align:right">${money(x.luong_thuc_nhan)}</td>

      <td style="text-align:right">
        ${
          isEditable
            ? `<input 
                type="number" 
                class="input-tra"
                value="${x.da_tra || 0}"
                min="0"
                data-id="${x.nhan_vien_id}"
                data-thang="${x.thang}"
                data-nam="${x.nam}"
                style="width:100px; padding:4px; text-align:right;"
              />`
            : `${money(x.da_tra || 0)}`
        }
      </td>

      <td>${x.ngay_tra_gan_nhat ? esc(x.ngay_tra_gan_nhat) : '-'}</td>
      <td>${statusBadge(x.trang_thai_cuoi)}</td>

      <!-- THÊM CỘT NGƯỜI DUYỆT -->
      <td>${esc(x.nguoi_duyet_ten || '-')}</td>
    </tr>
  `;
}

//  GỌI API BÁO CÁO
async function runReport() {
  const qs = buildQuery();

  const res = await api(`/bao-cao/luong?${qs}`).catch(() => null);
  if (!res) return;

  const data = res.data ?? res;

  // render KPI
  renderCards(data);

  // render table
  $('#tbody').innerHTML =
    data.items.length > 0
      ? data.items.map(rowHtml).join('')
      : `<tr><td colspan="11" class="text-muted">Không có dữ liệu</td></tr>`;
}

// gửi email PDF lương
async function paySalary(nvId) {
  const thang = $('#thang').value;
  const nam = $('#nam').value;

  if (!thang || !nam) {
    alert('Vui lòng chọn tháng và năm trước khi trả lương!');
    return;
  }

  if (!confirm('Xác nhận trả lương và gửi phiếu lương PDF qua email?')) return;

  const res = await api('/tra-luong/pay', {
    method: 'POST',
    body: {
      nhan_vien_id: nvId,
      thang,
      nam,
    },
  }).catch(() => null);

  if (!res) {
    alert('Lỗi server khi trả lương.');
    return;
  }

  alert('Đã trả lương & gửi email thành công!');
  runReport(); // reload lại dữ liệu
}

//  XEM CHI TIẾT LƯƠNG
async function openDetail(btn) {
  const nvId = btn.dataset.id;
  const thang = btn.dataset.thang;
  const nam = btn.dataset.nam;

  // Lấy chi tiết lương
  const res = await api(
    `/bao-cao/luong/chi-tiet/${nvId}?thang=${thang}&nam=${nam}`
  ).catch(() => null);

  const d = res?.data ?? res;
  const box = $('#m-body');

  $('#m-title').textContent = `Chi tiết lương #${nvId} (${thang}/${nam})`;

  if (!d) {
    box.textContent = 'Không có dữ liệu.';
    return;
  }

  // Lấy toàn bộ lịch sử trả lương
  const his = await api(
    `/bao-cao/luong/lich-su/${nvId}?thang=${thang}&nam=${nam}`
  ).catch(() => ({ items: [] }));

  // Render lịch sử trả lương
  let historyHtml = '';

  if (!his.items || his.items.length === 0) {
    historyHtml = `<p class="text-muted">Chưa có giao dịch trả lương nào.</p>`;
  } else {
    historyHtml = his.items
      .map(
        (h) => `
        <div style="border-bottom:1px solid #ddd; padding:6px 0;">
        <strong>${h.ngay_tra}</strong>
        — <span style="color:green">${money(h.so_tien_thuc_tra)} đ</span><br>
        <span class="text-muted">
          Trạng thái: ${h.trang_thai}
          ${
            h.nguoi_thuc_hien
              ? ` • Người thực hiện: ${esc(h.nguoi_thuc_hien)}`
              : ''
          }
        </span>
      </div>
      `
      )
      .join('');
  }

  box.innerHTML = `
    <p><strong>${esc(d.ho_ten)}</strong> (${esc(d.phong_ban)} – ${esc(
    d.chuc_vu
  )})</p>
    <p class="text-muted">Kỳ lương: ${d.thang}/${d.nam}</p>

    <div style="display:flex; gap:20px;">
      <div style="flex:1;">
        <h4>Thu nhập</h4>
        <p>P1 (lương thủa thuận): ${money(d.p1_luong)} đ</p>
        <p>P2 (phụ cấp): ${money(d.p2_phu_cap)} đ</p>
        <p>P3 (thưởng/phạt + tăng ca): ${money(d.p3_khac)} đ</p>
        <p><strong>Tổng Gross: ${money(d.tong_luong)} đ</strong></p>
      </div>

      <div style="flex:1;">
        <h4>Khấu trừ</h4>
        <p>BHXH: ${money(d.bhxh)}</p>
        <p>BHYT: ${money(d.bhyt)}</p>
        <p>BHTN: ${money(d.bhtn)}</p>
        <p>Thuế TNCN: ${money(d.thue_tncn)}</p>
      </div>
    </div>

    <h4 style="margin-top:10px;">Công  Nghỉ  Tăng ca</h4>
    <p>Ngày công: ${d.so_ngay_cong} ngày</p>
    <p>Nghỉ phép: ${d.so_ngay_nghi_phep} ngày</p>
    <p>Nghỉ hưởng lương: ${d.so_ngay_nghi_huong_luong} ngày</p>
    <p>Giờ tăng ca: ${d.gio_tang_ca} giờ</p>

    <div class="card" style="padding:12px; margin-top: 15px; background:#e6ffe6;">
      <div class="text-muted">LƯƠNG THỰC NHẬN:</div>
      <div style="font-size:24px; font-weight:700; color:green;">
        ${money(d.luong_thuc_nhan)} đ
      </div>

      <div class="detail-item">
        <span class="detail-label">Đã trả:</span>
        <span class="detail-value">${money(d.da_tra)} đ</span>
      </div>

      <div class="detail-item">
        <span class="detail-label">Còn nợ:</span>
        <span class="detail-value" style="color:red">${money(d.con_no)} đ</span>
      </div>

      <p class="text-muted">Trạng thái: ${esc(d.trang_thai_cuoi)}</p>

      <!-- THÊM THÔNG TIN NGƯỜI DUYỆT -->
      <p class="text-muted" style="margin-top:8px;">Người duyệt: <strong>${esc(
        d.nguoi_duyet_ten || 'Chưa có'
      )}</strong></p>
    </div>

    <h4 style="margin-top:20px;"><i class="fa-solid fa-thumbtack" style="color:#e74a3b; transform: rotate(45deg);"></i>
     Lịch sử trả lương</h4>
    <div style="max-height:200px; overflow-y:auto; padding-right:5px;">
      ${historyHtml}
    </div>
  `;

  $('#modal').showModal();
}

//  BIND SỰ KIỆN
function bind() {
  // 1. Gắn sự kiện cho các bộ lọc
  ['thang', 'nam', 'phong_ban', 'search', 'nguoi_duyet'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => runReport());
    el.addEventListener('change', () => runReport());
  });

  /* ----------------------------
     TAB TRẠNG THÁI
  ----------------------------- */
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document
        .querySelectorAll('.tab-btn')
        .forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      window._currentTab = btn.dataset.status || '';
      runReport();
    });
  });

  /* ----------------------------
     CLICK "Xem chi tiết"
  ----------------------------- */
  $('#tbody')?.addEventListener('click', (e) => {
    const btnDetail = e.target.closest('button[data-act="detail"]');
    if (btnDetail) return openDetail(btnDetail);
  });

  /* ----------------------------
     CLICK "Trả lương từng người" 
  ----------------------------- */
  $('#tbody')?.addEventListener('click', async (e) => {
    const btnPay = e.target.closest('button[data-act="pay"]');
    if (!btnPay) return;

    e.stopPropagation();

    if (!canPay()) {
      alert('Bạn không có quyền thực hiện thao tác trả lương.');
      return;
    }

    const nvId = btnPay.dataset.id;
    const thang = btnPay.dataset.thang;
    const nam = btnPay.dataset.nam;
    const conNo = Number(btnPay.dataset.conno || 0);

    const inp = document.querySelector(
      `input.input-tra[data-id="${nvId}"][data-thang="${thang}"][data-nam="${nam}"]`
    );

    let soTien = inp ? Number(inp.value) : conNo;

    if (conNo > 0 && (soTien === undefined || soTien === null || soTien <= 0)) {
      soTien = conNo;
    } else if (conNo === 0) {
      soTien = 0;
    }

    let confirmMsg = `Xác nhận trả ${money(soTien)} đ cho nhân viên #${nvId}?`;
    if (soTien === 0) {
      confirmMsg = `Nhân viên #${nvId} có lương thực nhận bằng 0đ. Bạn có muốn tất toán kỳ lương này không?`;
    }

    if (!confirm(confirmMsg)) return;

    const res = await api('/tra-luong/pay', {
      method: 'POST',
      body: { nhan_vien_id: nvId, thang, nam, so_tien_thuc_tra: soTien },
    }).catch(() => null);

    if (res && res.ok) {
      alert('Đã xử lý thanh toán thành công!');
      runReport();
    } else {
      alert(res?.error || 'Lỗi server khi trả lương!');
    }
  });

  /* ----------------------------
     NÚT "TRẢ TẤT CẢ" 
  ----------------------------- */
  const btnPayAll = document.getElementById('btn-pay-all');
  btnPayAll?.addEventListener('click', async (e) => {
    if (!canPay()) {
      alert('Bạn không có quyền thực hiện thanh toán.');
      return;
    }

    const thang = $('#thang').value;
    const nam = $('#nam').value;
    const pbId = $('#phong_ban').value;

    if (!thang || !nam) {
      alert('Vui lòng chọn đầy đủ tháng và năm!');
      return;
    }

    const confirmMsg = `Xác nhận TẤT TOÁN nợ lương cho TẤT CẢ nhân viên ĐÃ DUYỆT trong tháng ${thang}/${nam}?`;
    if (!confirm(confirmMsg)) return;

    // Hiệu ứng chờ
    btnPayAll.disabled = true;
    const originalText = btnPayAll.textContent;
    btnPayAll.textContent = 'Đang xử lý...';

    try {
      const res = await api('/tra-luong/pay-all', {
        method: 'POST',
        body: { thang, nam, phong_ban_id: pbId },
      });

      if (res.ok) {
        alert(
          `Thành công! Đã xử lý thanh toán cho ${res.result.count} nhân viên.`
        );
        runReport();
      } else {
        alert(res.error || 'Có lỗi xảy ra khi trả lương hàng loạt.');
      }
    } catch (err) {
      alert('Lỗi kết nối máy chủ.');
    } finally {
      btnPayAll.disabled = false;
      btnPayAll.textContent = originalText;
    }
  });

  /* ----------------------------
     CÁC SỰ KIỆN KHÁC (Modal, Export, Logout)
  ----------------------------- */
  $('#m-close')?.addEventListener('click', () => $('#modal').close());

  const modal = document.getElementById('modal');
  modal?.addEventListener('click', (event) => {
    const rect = modal.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) {
      modal.close();
    }
  });

  if (!canExport()) {
    const btnExp = document.getElementById('btn-export');
    if (btnExp) btnExp.style.display = 'none';
  }

  $('#btn-export')?.addEventListener('click', async () => {
    const qs = buildQuery();
    const token = getToken();
    const res = await fetch(`/bao-cao/luong/export?${qs}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return alert('Không thể xuất Excel!');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bao-cao-luong-${$('#thang').value}-${$('#nam').value}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  });

  $('#logout-btn')?.addEventListener('click', () => {
    clearAuth();
    location.href = './dang-nhap.html';
  });
}

//  LOAD PHÒNG BAN
async function loadPhongBan() {
  const res = await api('/phong-ban').catch(() => null);
  if (!res || !res.items) return;

  const sel = $('#phong_ban');
  res.items.forEach((pb) => {
    const opt = document.createElement('option');
    opt.value = pb.id;
    opt.textContent = pb.ten_phong_ban;
    sel.appendChild(opt);
  });
}

//  LOAD NGƯỜI DUYỆT (THÊM HÀM NÀY)
async function loadNguoiDuyet() {
  const res = await api('/users/duyet-luong').catch(() => null);
  if (!res || !res.items) return;

  const sel = $('#nguoi_duyet');
  res.items.forEach((user) => {
    const opt = document.createElement('option');
    opt.value = user.id;
    opt.textContent = user.ho_ten;
    sel.appendChild(opt);
  });
}

function setupCalendarFilters() {
  const selThang = $('#thang');
  const selNam = $('#nam');
  const now = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear = now.getFullYear();

  if (selThang) {
    let htmlThang = '<option value="">Tháng</option>';
    for (let i = 1; i <= 12; i++) {
      htmlThang += `<option value="${i}" ${
        i === curMonth ? 'selected' : ''
      }>Tháng ${i}</option>`;
    }
    selThang.innerHTML = htmlThang;
  }
  if (selNam) {
    let htmlNam = '<option value="">Năm</option>';
    for (let i = curYear - 5; i <= curYear + 1; i++) {
      htmlNam += `<option value="${i}" ${
        i === curYear ? 'selected' : ''
      }>${i}</option>`;
    }
    selNam.innerHTML = htmlNam;
  }
}

//  INIT
async function init() {
  requireAuthOrRedirect('./dang-nhap.html');
  if (!getToken()) return;

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const selThang = $('#thang');
  const selNam = $('#nam');

  if (selThang) {
    selThang.value = currentMonth;
  }

  if (selNam) {
    selNam.value = currentYear;
  }

  const footerYear = $('#y');
  if (footerYear) footerYear.textContent = currentYear;

  setUserBadge();

  document
    .querySelectorAll('.tab-btn')
    .forEach((b) => b.classList.remove('active'));
  window._currentTab = 'cho_xu_ly';
  const defaultTab = document.querySelector(
    '.tab-btn[data-status="cho_xu_ly"]'
  );
  if (defaultTab) defaultTab.classList.add('active');

  bind();

  await Promise.all([loadPhongBan(), loadNguoiDuyet()]);

  runReport();
}

document.addEventListener('DOMContentLoaded', init);
