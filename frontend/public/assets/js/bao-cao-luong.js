import {
  api,
  getUser,
  getToken,
  clearAuth,
  requireAuthOrRedirect,
} from './api.js';
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
const money = (v) => (v == null ? 0 : Number(v)).toLocaleString('vi-VN');

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

function unwrapReport(r) {
  const d = r?.data ?? r ?? {};
  // kỳ vọng có thể là:
  // { summary:{tong_co_ban, tong_phu_cap, tong_thuong, tong_khac, tong_chi, so_nv}, items:[...] }
  // hoặc chỉ items (mỗi item có các trường lương)
  const summary = d.summary ?? {
    tong_co_ban: d.tong_co_ban ?? 0,
    tong_phu_cap: d.tong_phu_cap ?? 0,
    tong_thuong: d.tong_thuong ?? 0,
    tong_khac: d.tong_khac ?? 0,
    tong_chi: d.tong_chi ?? d.tong_tien ?? 0,
    so_nv: d.so_nv ?? (Array.isArray(d.items) ? d.items.length : 0),
  };
  const items = Array.isArray(d.items) ? d.items : Array.isArray(d) ? d : [];
  return { summary, items };
}

function renderCards(s) {
  const parts = [
    { k: 'tong_chi', label: 'TỔNG CHI', val: s.tong_chi },
    { k: 'tong_co_ban', label: 'LƯƠNG THỎA THUẬN', val: s.tong_co_ban },
    { k: 'tong_phu_cap', label: 'PHỤ CẤP', val: s.tong_phu_cap },
    { k: 'tong_thuong', label: 'THƯỞNG', val: s.tong_thuong },
    { k: 'tong_khac', label: 'KHOẢN KHÁC', val: s.tong_khac },
    { k: 'so_nv', label: 'SỐ NHÂN VIÊN', val: s.so_nv },
  ];
  const max = Math.max(1, ...parts.map((p) => Number(p.val) || 0));
  $('#cards').innerHTML = parts
    .map(
      (p) => `
    <div class="card card-kpi">
      <p class="kpi-title">${p.label}</p>
      <p class="kpi-value">${p.k === 'so_nv' ? esc(p.val) : money(p.val)}</p>
      ${
        p.k === 'so_nv'
          ? ''
          : `<div class="bar"><div style="width:${Math.round(
              ((Number(p.val) || 0) / max) * 100
            )}%"></div></div>`
      }
    </div>
  `
    )
    .join('');
}

function rowHtml(x) {
  const total = Number(x.thuc_nhan || 0);
  const hoten = x.nhan_vien?.ho_ten || x.ho_ten || '';
  const id = x.nhan_vien_id ?? x.id ?? '';

  return `<tr>
    <td>${esc(id)}</td>
    <td>${esc(hoten)}</td>
    <td>${money(x.luong_thoa_thuan)}</td>
    <td>${money(x.phu_cap)}</td>
    <td>${money(x.thuong)}</td>
    <td>${money(x.khoan_khac)}</td>
    <td>${money(total)}</td>
    <td><button class="page-btn" data-act="detail" data-id="${id}">Xem chi tiết</button></td>
  </tr>`;
}

async function runReport() {
  const thang = $('#thang').value;
  const nam = $('#nam').value || new Date().getFullYear();
  const phong_ban_id = $('#phong_ban').value;
  const nhan_vien_id = $('#nhan_vien').value;

  const qs = new URLSearchParams({ nam });
  if (thang) qs.append('thang', thang);
  if (phong_ban_id) qs.append('phong_ban_id', phong_ban_id);
  if (nhan_vien_id) qs.append('nhan_vien_id', nhan_vien_id);

  const res = await api(`/bao-cao/luong?${qs}`).catch(() => null);
  if (!res) return;

  const data = res.data ?? res;
  const grouped = data.grouped_by_thang ?? null;

  // ✅ Nếu không có tháng => hiển thị theo tháng (collapse)
  if (!thang && grouped) {
    let html = '';
    for (const [thangNum, list] of Object.entries(grouped)) {
      html += `
        <tr class="month-header">
          <td colspan="8" style="background:#eef2ff;font-weight:600;">
            Tháng ${thangNum} 
            <button class="toggle-btn" data-thang="${thangNum}">▼</button>
          </td>
        </tr>
        <tbody id="month-${thangNum}" style="display:none;">
          ${list.map(rowHtml).join('')}
        </tbody>
      `;
    }
    $('#tbody').innerHTML = html;

    // bind toggle
    document.querySelectorAll('.toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.thang;
        const tb = document.getElementById(`month-${id}`);
        tb.style.display =
          tb.style.display === 'none' ? 'table-row-group' : 'none';
      });
    });
  } else {
    // ✅ Nếu chọn tháng hoặc có lọc khác => hiển thị danh sách
    $('#tbody').innerHTML =
      data.items.length > 0
        ? data.items.map(rowHtml).join('')
        : `<tr><td colspan="8" class="text-muted">Không có dữ liệu</td></tr>`;
  }

  renderCards(data);
}

async function openDetail(nvId) {
  const thang = $('#thang').value,
    nam = $('#nam').value;
  const res = await api(
    `/bao-cao/luong/chi-tiet/${nvId}?thang=${thang}&nam=${nam}`
  ).catch(() => null);

  $(
    '#m-title'
  ).textContent = `Chi tiết lương nhân viên #${nvId} (${thang}/${nam})`;
  const box = $('#m-body');

  const d = res?.data ?? res;

  if (d && typeof d === 'object' && d.luong_thuc_nhan !== undefined) {
    box.innerHTML = `
      <p><strong>Nhân viên:</strong> ${esc(d.ho_ten)} (${esc(
      d.phong_ban
    )} - ${esc(d.chuc_vu)})</p>
      <p class="text-muted">Kỳ lương: Tháng ${esc(d.thang)}/${esc(d.nam)}</p>

      <div style="display:flex; gap: 20px;">
        <div style="flex: 1;">
          <h4>✅ THU NHẬP</h4>
          <p>Lương thỏa thuận: ${money(d.p1_luong)} đ</p>
          <p>Phụ cấp: ${money(d.p2_phu_cap)} đ</p>
          <p>Khoản khác/Thưởng: ${money(d.p3_khac)} đ</p>
          <p><strong>Tổng trước khấu trừ: ${money(d.tong_luong)} đ</strong></p>
        </div>
        <div style="flex: 1;">
          <h4>➖ KHẤU TRỪ & DỮ LIỆU CÔNG</h4>
          <p>Ngày công thực tế: ${esc(d.ngay_cong)} ngày</p>
          <p>Giờ tăng ca: ${esc(d.gio_tang_ca)} giờ</p>
          <hr/>
          <p>BHXH/BHYT/BHTN: - ${money(d.tong_bh)} đ</p>
          <p>Thuế TNCN: - ${money(d.thue_tncn)} đ</p>
        </div>
      </div>

      <div class="card" style="padding:12px; margin-top: 15px; background: #e6ffe6;">
        <div class="text-muted">LƯƠNG THỰC NHẬN:</div>
        <div style="font-size:24px; font-weight:700; color: var(--success);">${money(
          d.luong_thuc_nhan
        )} đ</div>
        <p class="text-muted" style="margin-top: 5px;">Trạng thái duyệt: ${esc(
          d.trang_thai_duyet
        )}</p>
      </div>
    `;
  } else {
    box.textContent = 'Không có dữ liệu chi tiết cho kỳ lương này.';
  }

  $('#modal').showModal();
}

function bind() {
  // 🔹 Nút "Xem báo cáo"
  const btnRun = document.getElementById('btn-run');
  if (btnRun) {
    btnRun.addEventListener('click', () => runReport().catch(() => {}));
  } else {
    console.warn('⚠️ Không tìm thấy nút #btn-run');
  }

  // 🔹 Nút "Xuất Excel"
  const btnExport = document.getElementById('btn-export');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      const thang = $('#thang').value;
      const nam = $('#nam').value || new Date().getFullYear();
      const phong_ban_id = $('#phong_ban').value;
      const nhan_vien_id = $('#nhan_vien').value;

      const qs = new URLSearchParams({ nam });
      if (thang) qs.append('thang', thang);
      if (phong_ban_id) qs.append('phong_ban_id', phong_ban_id);
      if (nhan_vien_id) qs.append('nhan_vien_id', nhan_vien_id);

      window.open(`/api/bao-cao/luong/export?${qs}`, '_blank');
    });
  } else {
    console.warn('⚠️ Không tìm thấy nút #btn-export');
  }

  // 🔹 Bảng dữ liệu (xử lý click "Xem chi tiết")
  const tbody = document.getElementById('tbody');
  if (tbody) {
    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-act="detail"]');
      if (!btn) return;
      openDetail(btn.dataset.id).catch(() => {});
    });
  } else {
    console.warn('⚠️ Không tìm thấy #tbody');
  }

  // 🔹 Nút đóng modal
  const btnClose = document.getElementById('m-close');
  const modal = document.getElementById('modal');
  if (btnClose && modal) {
    btnClose.addEventListener('click', () => modal.close());
  } else {
    console.warn('⚠️ Thiếu #m-close hoặc #modal');
  }

  // 🔹 Nút đăng xuất
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearAuth();
      location.href = './dangnhap.html';
    });
  } else {
    console.warn('⚠️ Không tìm thấy nút #logout-btn');
  }
}

async function init() {
  requireAuthOrRedirect('./dangnhap.html');
  if (!getToken()) return;
  $('#y').textContent = new Date().getFullYear();
  setUserBadge();
  bind();
}
document.addEventListener('DOMContentLoaded', init);
