import {
  api,
  getUser,
  getToken,
  clearAuth,
  requireAuthOrRedirect,
} from './api.js';
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) =>
  (s ?? '')
    .toString()
    .replace(
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
    { k: 'tong_co_ban', label: 'LƯƠNG CƠ BẢN', val: s.tong_co_ban },
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
  const total =
    Number(x.luong_co_ban || 0) +
    Number(x.phu_cap || 0) +
    Number(x.thuong || 0) +
    Number(x.khoan_khac || 0);
  const hoten = x.nhan_vien?.ho_ten || x.ho_ten || '';
  const id = x.nhan_vien_id ?? x.id ?? '';
  return `<tr>
    <td>${esc(id)}</td>
    <td>${esc(hoten)}</td>
    <td>${money(x.luong_co_ban)}</td>
    <td>${money(x.phu_cap)}</td>
    <td>${money(x.thuong)}</td>
    <td>${money(x.khoan_khac)}</td>
    <td>${money(total)}</td>
    <td><button class="page-btn" data-act="detail" data-id="${id}">Xem chi tiết</button></td>
  </tr>`;
}

async function runReport() {
  const thang = $('#thang').value,
    nam = $('#nam').value;
  if (!thang || !nam) {
    $(
      '#tbody'
    ).innerHTML = `<tr><td colspan="8" class="text-muted">Vui lòng chọn Tháng và Năm</td></tr>`;
    $('#cards').innerHTML = '';
    return;
  }
  const qs = new URLSearchParams({ thang, nam });
  const res = await api(`/bao-cao/luong?${qs.toString()}`).catch(() => null);
  if (!res) {
    $(
      '#tbody'
    ).innerHTML = `<tr><td colspan="8" class="text-muted">Không lấy được báo cáo</td></tr>`;
    $('#cards').innerHTML = '';
    return;
  }
  const { summary, items } = unwrapReport(res);
  renderCards(summary);
  $('#tbody').innerHTML =
    items && items.length
      ? items.map(rowHtml).join('')
      : `<tr><td colspan="8" class="text-muted">Không có dữ liệu chi tiết</td></tr>`;
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
  if (!res) {
    box.textContent = 'Không lấy được chi tiết.';
    $('#modal').showModal();
    return;
  }
  const d = res?.data ?? res;
  if (Array.isArray(d) && d.length) {
    const rows = d
      .map(
        (x, i) => `<tr>
      <td>${i + 1}</td>
      <td>${esc(x.khoan || x.ten || 'Khoản')}</td>
      <td>${money(x.so_tien ?? x.gia_tri ?? 0)}</td>
      <td>${esc(x.ghi_chu || '')}</td>
    </tr>`
      )
      .join('');
    box.innerHTML = `<table class="table">
      <thead><tr><th>#</th><th>Khoản</th><th>Số tiền</th><th>Ghi chú</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  } else if (d && typeof d === 'object') {
    const total = money(Number(d.tong_tien || d.tong_chi || 0));
    box.innerHTML = `
      <div class="card" style="padding:12px;">
        <div class="text-muted">Tổng chi:</div>
        <div style="font-size:20px; font-weight:700;">${total} đ</div>
      </div>`;
  } else {
    box.textContent = 'Không có dữ liệu.';
  }
  $('#modal').showModal();
}

function bind() {
  $('#btn-run').addEventListener('click', () => runReport().catch(() => {}));
  $('#tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act="detail"]');
    if (!btn) return;
    openDetail(btn.dataset.id).catch(() => {});
  });
  $('#m-close').addEventListener('click', () => $('#modal').close());
  $('#logout-btn').addEventListener('click', () => {
    clearAuth();
    location.href = './dangnhap.html';
  });
}

async function init() {
  requireAuthOrRedirect('./dangnhap.html');
  if (!getToken()) return;
  $('#y').textContent = new Date().getFullYear();
  setUserBadge();
  bind();
}
document.addEventListener('DOMContentLoaded', init);
