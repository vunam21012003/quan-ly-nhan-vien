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
  if (role === 'employee' || role === 'nhanvien') {
    $('#btn-calc').style.display = 'none';
  }
}

function pageInfo() {
  const totalPages = Math.max(1, Math.ceil(st.total / st.limit));
  $('#pageInfo').textContent = `Trang ${st.page}/${totalPages}`;
  $('#prev').disabled = st.page <= 1;
  $('#next').disabled = st.page >= totalPages;
}

function rowHtml(x) {
  return `<tr>
    <td>${esc(x.id)}</td>
    <td>${esc(x.ho_ten || '')}</td>
    <td>${esc(x.he_so_luong ?? 1)}</td>
    <td>${money(x.luong_co_ban)}</td>
    <td>${esc(x.ngay_cong ?? 0)}</td>
    <td>${esc(x.gio_tang_ca ?? 0)}</td>
    <td>${money(x.phu_cap)}</td>
    <td>${money(x.thuong)}</td>
    <td>${money(x.khau_tru)}</td>
    <td><b>${money(x.luong_thuc_nhan ?? 0)}</b></td>
    <td>
      <button class="page-btn" data-act="edit" data-id="${x.id}">Sửa</button>
      <button class="page-btn" data-act="del" data-id="${x.id}">Xóa</button>
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
    : `<tr><td colspan="11" class="text-muted">Không có dữ liệu</td></tr>`;
  pageInfo();
}

function openModal(row = null) {
  st.editingId = row?.id ?? null;
  $('#modal-title').textContent = row
    ? `Sửa bản lương #${row.id}`
    : 'Thêm bản lương';

  $('#nhan_vien_id').value = row?.nhan_vien_id ?? '';
  $('#luong_co_ban').value = row?.luong_co_ban ?? '';
  $('#he_so_luong').value = row?.he_so_luong ?? 1.0;
  $('#ngay_cong').value = row?.ngay_cong ?? 26;
  $('#gio_tang_ca').value = row?.gio_tang_ca ?? 0;
  $('#phu_cap').value = row?.phu_cap ?? 0;
  $('#thuong').value = row?.thuong ?? 0;
  $('#khau_tru').value = row?.khau_tru ?? 0;
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
    luong_co_ban: Number($('#luong_co_ban').value || 0),
    he_so_luong: Number($('#he_so_luong').value || 1),
    ngay_cong: Number($('#ngay_cong').value || 0),
    gio_tang_ca: Number($('#gio_tang_ca').value || 0),
    phu_cap: Number($('#phu_cap').value || 0),
    thuong: Number($('#thuong').value || 0),
    khau_tru: Number($('#khau_tru').value || 0),
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
  // ===== Nút tải lại & lọc =====
  $('#btn-refresh').addEventListener('click', () =>
    fetchList().catch(() => {})
  );
  $('#btn-search').addEventListener('click', () => {
    st.page = 1;
    fetchList().catch(() => {});
  });

  // ===== TÍNH LƯƠNG THÁNG (và hỏi chia thưởng) =====
  $('#btn-calc').addEventListener('click', async () => {
    const thang = $('#thang').value;
    const nam = $('#nam').value;

    if (!thang || !nam) {
      alert('⚠️ Vui lòng chọn Tháng và Năm để tính lương!');
      return;
    }

    // Kiểm tra xem tháng đó đã có dữ liệu lương chưa
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

      // Sau khi tính xong, chia thưởng (nếu có)
      const tongThuong = Number($('#tong_thuong')?.value || 0);
      const tyLeCoDinh = Number($('#ty_le_co_dinh')?.value || 0);
      const tyLeDiemCong = Number($('#ty_le_diem_cong')?.value || 0);

      if (tongThuong >= 0) {
        const body = {
          tong_thuong: tongThuong,
          ty_le_co_dinh: tyLeCoDinh / 100,
          ty_le_diem_cong: tyLeDiemCong / 100,
        };
        await api('/luong/chia-thuong', { method: 'POST', body });
        await fetchList();
        alert('🎉 Đã chia thưởng thành công!');
      }
    } catch (err) {
      alert('❌ Lỗi khi tính lương: ' + (err?.message || 'Không xác định'));
    }
  });

  // ===== Hủy modal & lưu lương =====
  $('#btn-cancel').addEventListener('click', closeModal);
  $('#form').addEventListener('submit', onSave);

  // ===== Phân trang =====
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

  // ===== Sửa / Xóa lương =====
  $('#tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.act;
    const row = st.items.find((x) => String(x.id) === String(id));

    if (act === 'edit') openModal(row);
    if (act === 'del') {
      if (!confirm(`Xóa bản lương #${id}?`)) return;
      try {
        await api(`/luong/${id}`, { method: 'DELETE' });
        await fetchList();
      } catch (err) {
        alert(err?.message || 'Không thể xóa');
      }
    }
  });

  // ===== Logout =====
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

// ====== SINH TỰ ĐỘNG DANH SÁCH THÁNG + NĂM ======
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
