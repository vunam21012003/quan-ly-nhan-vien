import {
  api,
  getUser,
  getToken,
  clearAuth,
  requireAuthOrRedirect,
} from './api.js';

const st = { page: 1, limit: 10, total: 0, items: [], editingId: null };

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
const money = (v) =>
  (v == null ? 0 : Number(v)).toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
  });

function unwrap(r) {
  const d = r?.data ?? r;
  if (Array.isArray(d)) return { items: d, total: d.length };
  if (d?.items) return { items: d.items, total: d.total ?? d.items.length };
  if (d?.rows) return { items: d.rows, total: d.total ?? d.rows.length };
  return { items: d?.list ?? [], total: d?.total ?? 0 };
}

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
  if (role === 'employee' || role === 'nhanvien')
    $('#btn-calc').style.display = 'none';
}

function pageInfo() {
  const totalPages = Math.max(1, Math.ceil(st.total / st.limit));
  $('#pageInfo').textContent = `Trang ${st.page}/${totalPages}`;
  $('#prev').disabled = st.page <= 1;
  $('#next').disabled = st.page >= totalPages;
}

function rowHtml(x) {
  const gross = x.tong_luong ?? x.luong_thoa_thuan + x.luong_p2 + x.luong_p3;
  const net = x.luong_thuc_nhan ?? gross - (x.tong_bh ?? 0);

  return `
  <tr class="salary-row" data-id="${x.id}">
    <td>${esc(x.id)}</td>
    <td>${esc(x.ho_ten || '')}</td>
    <td>${money(gross)}</td>
    <td class="salary-net">${money(net)}</td>
    <td>${esc(x.thang)}/${esc(x.nam)}</td>
    <td>${money(x.bhxh)}</td>
    <td>${money(x.thue_tncn ?? 0)}</td>
    <td>
      <button class="page-btn" data-act="expand" data-id="${x.id}">▼</button>
      <button class="page-btn" data-act="edit" data-id="${x.id}">✏️</button>
      <button class="page-btn" data-act="del" data-id="${x.id}">🗑️</button>
    </td>
  </tr>
  <tr class="expand-row" id="expand-${x.id}">
    <td colspan="8">
      <div class="expand-box">
        <h4>I. Thành phần thu nhập</h4>
        <table>
          <tr><td>P1 – Lương thỏa thuận:</td><td>${money(
            x.luong_p1 ?? x.luong_thoa_thuan
          )}</td></tr>
          <tr><td>P2 – Phụ cấp:</td><td>${money(x.luong_p2 ?? 0)}</td></tr>
          <tr><td>P3 – Tăng ca / Thưởng / Phạt:</td><td>${money(
            x.luong_p3 ?? 0
          )}</td></tr>
          <tr><td><b>Tổng lương (Gross):</b></td><td><b>${money(
            gross
          )}</b></td></tr>
        </table>

        <h4>II. Các khoản khấu trừ</h4>
        <table>
          <tr><td>BHXH (8%):</td><td>${money(x.bhxh ?? 0)}</td></tr>
          <tr><td>BHYT (1.5%):</td><td>${money(x.bhyt ?? 0)}</td></tr>
          <tr><td>BHTN (1%):</td><td>${money(x.bhtn ?? 0)}</td></tr>
          <tr><td>Tổng bảo hiểm:</td><td>${money(x.tong_bh ?? 0)}</td></tr>
          <tr><td>Thuế TNCN:</td><td>${money(x.thue_tncn ?? 0)}</td></tr>
          <tr><td><b>Lương thực nhận (Net):</b></td><td><b>${money(
            net
          )}</b></td></tr>
        </table>

        <h4>III. Thông tin công & tăng ca</h4>
        <table>
          <tr><td>Số ngày công:</td><td>${esc(x.ngay_cong_lam ?? 0)}</td></tr>
          <tr><td>Số ngày nghỉ phép:</td><td>${esc(
            x.so_ngay_nghi_phep ?? 0
          )}</td></tr>
          <tr><td>Giờ tăng ca:</td><td>${esc(x.gio_tang_ca ?? 0)}</td></tr>
        </table>
      </div>
    </td>
  </tr>`;
}

async function fetchList() {
  const qs = new URLSearchParams({
    page: String(st.page),
    limit: String(st.limit),
  });
  const thang = $('#thang').value;
  if (thang) qs.set('thang', thang);
  const nam = $('#nam').value;
  if (nam) qs.set('nam', nam);

  const resp = await api(`/luong?${qs}`).catch(() => ({ data: [] }));
  const { items, total } = unwrap(resp);
  st.items = items;
  st.total = total || items.length;

  const tbody = $('#tbody');
  tbody.innerHTML = items.length
    ? items.map(rowHtml).join('')
    : `<tr><td colspan="10" class="text-muted">Không có dữ liệu</td></tr>`;
  pageInfo();
}

function openModal(row = null) {
  st.editingId = row?.id ?? null;
  $('#modal-title').textContent = row
    ? `Sửa bản lương #${row.id}`
    : 'Thêm bản lương';

  $('#nhan_vien_id').value = row?.nhan_vien_id ?? '';
  $('#luong_thoa_thuan').value = row?.luong_thoa_thuan ?? '';
  $('#he_so_luong').value = row?.he_so_luong ?? 1.0;
  $('#tong_gio_lam').value = row?.tong_gio_lam ?? 0;
  $('#gio_tang_ca').value = row?.gio_tang_ca ?? 0;
  $('#luong_p2').value = row?.luong_p2 ?? 0;
  $('#luong_p3').value = row?.luong_p3 ?? 0;
  $('#ghi_chu').value = row?.ghi_chu ?? '';

  if (row?.nam && row?.thang)
    $('#thang_nam').value = `${row.nam}-${String(row.thang).padStart(2, '0')}`;
  else $('#thang_nam').value = '';

  $('#modal-error').hidden = true;
  $('#modal').showModal();
}
function closeModal() {
  $('#modal').close();
}
function showErr(m) {
  const el = $('#modal-error');
  el.hidden = false;
  el.textContent = m;
}

async function onSave(e) {
  e.preventDefault();
  $('#modal-error').hidden = true;

  const [nam, thang] = $('#thang_nam').value.split('-').map(Number);
  const payload = {
    nhan_vien_id: Number($('#nhan_vien_id').value),
    thang,
    nam,
    luong_thoa_thuan: Number($('#luong_thoa_thuan').value || 0),
    he_so_luong: Number($('#he_so_luong').value || 1),
    tong_gio_lam: Number($('#tong_gio_lam').value || 0),
    gio_tang_ca: Number($('#gio_tang_ca').value || 0),
    luong_p2: Number($('#luong_p2').value || 0),
    luong_p3: Number($('#luong_p3').value || 0),
    ghi_chu: $('#ghi_chu').value.trim() || null,
  };

  if (!payload.nhan_vien_id || !payload.thang || !payload.nam) {
    showErr('Vui lòng nhập đủ Nhân viên, Tháng/Năm.');
    return;
  }

  try {
    if (st.editingId)
      await api(`/luong/${st.editingId}`, { method: 'PUT', body: payload });
    else await api('/luong', { method: 'POST', body: payload });
    closeModal();
    await fetchList();
  } catch (err) {
    showErr(err?.message || 'Lưu thất bại');
  }
}

function bind() {
  $('#btn-refresh').addEventListener('click', () =>
    fetchList().catch(() => {})
  );
  $('#btn-search').addEventListener('click', () => {
    st.page = 1;
    fetchList().catch(() => {});
  });

  $('#btn-calc').addEventListener('click', async () => {
    const thang = $('#thang').value,
      nam = $('#nam').value;
    if (!thang || !nam) {
      alert('⚠️ Vui lòng chọn Tháng và Năm để tính lương!');
      return;
    }
    const checkResp = await api(`/luong?thang=${thang}&nam=${nam}`);
    const { items } = unwrap(checkResp);
    const hasLuong = items && items.length > 0;
    const msg = hasLuong
      ? `Bạn có chắc muốn tính lại lương tháng ${thang}/${nam}?`
      : `Bạn có chắc muốn tính lương tháng ${thang}/${nam}?`;
    if (!confirm(msg)) return;

    try {
      await api(`/luong/tinh-thang?thang=${thang}&nam=${nam}`, {
        method: 'POST',
      });
      await fetchList();
      alert(`✅ Đã tính lương tháng ${thang}/${nam} thành công!`);
    } catch (err) {
      alert('❌ Lỗi khi tính lương: ' + (err?.message || 'Không xác định'));
    }
  });

  // ✅ THÊM NGAY SAU ĐOẠN TRÊN:
  $('#btn-approve').addEventListener('click', async () => {
    const thang = $('#thang').value,
      nam = $('#nam').value;
    if (!thang || !nam) {
      alert('⚠️ Vui lòng chọn Tháng và Năm để duyệt!');
      return;
    }
    if (!confirm(`Xác nhận duyệt toàn bộ lương tháng ${thang}/${nam}?`)) return;
    try {
      await api(`/luong/duyet-thang?thang=${thang}&nam=${nam}`, {
        method: 'POST',
      });
      alert(`✅ Đã duyệt toàn bộ lương tháng ${thang}/${nam}!`);
      await fetchList();
    } catch (err) {
      alert('❌ Lỗi duyệt: ' + (err?.message || 'Không xác định'));
    }
  });

  $('#btn-unapprove').addEventListener('click', async () => {
    const thang = $('#thang').value,
      nam = $('#nam').value;
    if (!thang || !nam) {
      alert('⚠️ Vui lòng chọn Tháng và Năm để hủy duyệt!');
      return;
    }
    if (!confirm(`Bạn có chắc muốn HỦY DUYỆT lương tháng ${thang}/${nam}?`))
      return;
    try {
      await api(`/luong/huy-duyet-thang?thang=${thang}&nam=${nam}`, {
        method: 'POST',
      });
      alert(`🔁 Đã hủy duyệt lương tháng ${thang}/${nam}!`);
      await fetchList();
    } catch (err) {
      alert('❌ Lỗi hủy duyệt: ' + (err?.message || 'Không xác định'));
    }
  });

  $('#btn-calc').addEventListener('click', async () => {
    const thang = $('#thang').value,
      nam = $('#nam').value;
    if (!thang || !nam) {
      alert('⚠️ Vui lòng chọn Tháng và Năm để tính lương!');
      return;
    }
    const checkResp = await api(`/luong?thang=${thang}&nam=${nam}`);
    const { items } = unwrap(checkResp);
    const hasLuong = items && items.length > 0;
    const msg = hasLuong
      ? `Bạn có chắc muốn tính lại lương tháng ${thang}/${nam}?`
      : `Bạn có chắc muốn tính lương tháng ${thang}/${nam}?`;
    if (!confirm(msg)) return;

    try {
      await api(`/luong/tinh-thang?thang=${thang}&nam=${nam}`, {
        method: 'POST',
      });
      await fetchList();
      alert(`✅ Đã tính lương tháng ${thang}/${nam} thành công!`);
    } catch (err) {
      alert('❌ Lỗi khi tính lương: ' + (err?.message || 'Không xác định'));
    }
  });

  $('#btn-cancel').addEventListener('click', closeModal);
  $('#form').addEventListener('submit', onSave);

  $('#prev').addEventListener('click', () => {
    if (st.page > 1) {
      st.page--;
      fetchList().catch(() => {});
    }
  });
  $('#next').addEventListener('click', () => {
    st.page++;
    fetchList().catch(() => {});
  });

  $('#tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;

    const id = btn.dataset.id;
    const act = btn.dataset.act;
    const row = st.items.find((x) => String(x.id) === String(id));

    // ✅ Mở rộng / ẩn chi tiết dòng lương
    if (act === 'expand') {
      const expandRow = document.getElementById(`expand-${id}`);
      if (!expandRow) return;
      expandRow.classList.toggle('active');
      btn.textContent = expandRow.classList.contains('active') ? '▲' : '▼';
      return;
    }

    // ✏️ Sửa bản lương
    if (act === 'edit') {
      openModal(row);
      return;
    }

    // 🗑️ Xóa bản lương
    if (act === 'del') {
      if (!confirm(`Bạn có chắc muốn xóa bản lương #${id}?`)) return;
      try {
        await api(`/luong/${id}`, { method: 'DELETE' });
        await fetchList();
      } catch (err) {
        alert(err?.message || 'Không thể xóa bản lương này.');
      }
    }
  });

  $('#logout-btn')?.addEventListener('click', () => {
    clearAuth();
    location.href = './dang-nhap.html';
  });
}

async function init() {
  requireAuthOrRedirect('./dang-nhap.html');
  if (!getToken()) return;
  $('#y').textContent = new Date().getFullYear();
  setUserBadge();
  setupMonthYearSelect();
  await fetchList();
  bind();
}
document.addEventListener('DOMContentLoaded', init);

function setupMonthYearSelect() {
  const thangSelect = document.getElementById('thang');
  const yearInput = document.getElementById('nam');
  if (!thangSelect) return;
  for (let i = 1; i <= 12; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `Tháng ${i}`;
    thangSelect.appendChild(opt);
  }
  const now = new Date();
  thangSelect.value = now.getMonth() + 1;
  yearInput.value = now.getFullYear();
}
