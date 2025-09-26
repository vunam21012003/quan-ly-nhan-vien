import { api, getUser, getToken, clearAuth, requireAuthOrRedirect } from './api.js';
const st = { list: [], editingId: null, page: 1, limit: 50, total: 0 };

function $(s, r=document){ return r.querySelector(s); }
function esc(s){ return (s ?? '').toString().replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
function setUserBadge(){
  const b = $('#user-badge'), u = getUser();
  if (!b) return;
  if (!u){ b.className='badge badge-warn'; b.textContent='Chưa đăng nhập'; return; }
  const role = u.role ?? u.quyen ?? 'user';
  b.className = 'badge badge-ok';
  b.textContent = `User: ${u.username ?? u.ten_dang_nhap ?? ''} • ${role}`;
  if (role === 'employee' || role==='nhanvien'){ $('#cv-btn-create').style.display='none'; }
}
function unwrap(r){ const d=r?.data ?? r; if (Array.isArray(d)) return {items:d,total:d.length}; if(d?.items) return {items:d.items,total:d.total??d.items.length}; return {items:d?.list??[],total:d?.total??0}; }
function rowHtml(x){
  return `<tr>
    <td>${esc(x.id)}</td>
    <td>${esc(x.ten)}</td>
    <td>${esc(x.mo_ta || '')}</td>
    <td>
      <button class="page-btn" data-act="edit" data-id="${x.id}">Sửa</button>
      <button class="page-btn" data-act="del"  data-id="${x.id}">Xoá</button>
    </td>
  </tr>`;
}

async function fetchList(){
  const s = $('#cv-search').value.trim();
  const qs = new URLSearchParams({ page:String(st.page), limit:String(st.limit) });
  if (s) qs.set('search', s);
  const res = await api(`/chuc-vu?${qs.toString()}`).catch(()=>({data:[]}));
  const { items, total } = unwrap(res);
  st.list = items; st.total = total || items.length;
  const tbody = $('#cv-tbody');
  tbody.innerHTML = items.length ? items.map(rowHtml).join('') : `<tr><td colspan="4" class="text-muted">Không có dữ liệu</td></tr>`;
}

function openModal(edit=null){
  st.editingId = edit?.id ?? null;
  $('#cv-modal-title').textContent = edit ? `Sửa chức vụ #${edit.id}` : 'Thêm chức vụ';
  $('#cv-ten').value   = edit?.ten ?? '';
  $('#cv-mo_ta').value = edit?.mo_ta ?? '';
  $('#cv-error').hidden = true;
  $('#cv-modal').showModal();
}
function closeModal(){ $('#cv-modal').close(); }
function showErr(m){ const el=$('#cv-error'); el.hidden=false; el.textContent=m; }

async function onSave(e){
  e.preventDefault();
  const payload = { ten: $('#cv-ten').value.trim(), mo_ta: $('#cv-mo_ta').value.trim() || null };
  if (!payload.ten) { showErr('Vui lòng nhập tên'); return; }
  try {
    if (st.editingId) await api(`/chuc-vu/${st.editingId}`, { method:'PUT', body: payload });
    else await api('/chuc-vu', { method:'POST', body: payload });
    closeModal();
    await fetchList();
  } catch(err){ showErr(err?.message || 'Lưu thất bại'); }
}

function bind(){
  $('#cv-btn-refresh').addEventListener('click', () => fetchList().catch(()=>{}));
  $('#cv-btn-search').addEventListener('click', () => { st.page=1; fetchList().catch(()=>{}); });
  $('#cv-btn-create').addEventListener('click', () => openModal(null));
  $('#cv-cancel').addEventListener('click', closeModal);
  $('#cv-form').addEventListener('submit', onSave);
  $('#cv-tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]'); if(!btn) return;
    const id = btn.dataset.id; const act = btn.dataset.act;
    const row = st.list.find(x => String(x.id)===String(id));
    if (act==='edit') openModal(row);
    if (act==='del') {
      if (!confirm(`Xoá chức vụ #${id}?`)) return;
      try { await api(`/chuc-vu/${id}`, { method:'DELETE' }); await fetchList(); }
      catch(err){ alert(err?.message || 'Không thể xoá'); }
    }
  });
  $('#logout-btn').addEventListener('click', () => { clearAuth(); location.href='./dangnhap.html'; });
}

async function init(){
  requireAuthOrRedirect('./dangnhap.html');
  if (!getToken()) return;
  $('#y')?.textContent = new Date().getFullYear();
  setUserBadge();
  await fetchList();
  bind();
}
document.addEventListener('DOMContentLoaded', init);
