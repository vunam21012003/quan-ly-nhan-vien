import { api, setToken, saveUser, healthCheck } from './api.js';

function setBadge(state, text) {
  const badge = document.getElementById('health-badge');
  if (!badge) return;
  const cls = {
    ok: 'badge badge-ok',
    warn: 'badge badge-warn',
    error: 'badge badge-error',
    muted: 'badge badge-muted',
  };
  badge.className = cls[state] || cls.muted;
  badge.textContent = text;
}

function setLoading(btn, on) {
  if (!btn) return;
  btn.disabled = !!on;
  btn.dataset.loading = on ? '1' : '';
  btn.textContent = on ? 'Đang đăng nhập…' : 'Đăng nhập';
}

// ✅ Chuẩn hoá quyền từ backend
function mapRole(user) {
  const raw = String(
    user?.role || user?.quyen_mac_dinh || user?.permission || ''
  )
    .toLowerCase()
    .trim();

  if (['admin', 'manager', 'employee'].includes(raw)) return raw;
  if (raw === 'nhanvien' || raw === 'user') return 'employee';
  return 'employee';
}

async function init() {
  // Hiển thị năm ở footer
  const y = document.getElementById('y');
  if (y) y.textContent = new Date().getFullYear();

  // Kiểm tra kết nối backend
  const { ok } = await healthCheck();
  if (ok) setBadge('ok', 'Hệ thống: OK');
  else setBadge('error', 'Hệ thống: Không kết nối');

  const form = document.getElementById('login-form');
  if (!form) return;

  const submitBtn = form.querySelector('button[type="submit"]');
  const errorBox = document.getElementById('login-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errorBox) {
      errorBox.hidden = true;
      errorBox.textContent = '';
    }

    const username = (form.querySelector('#username')?.value || '').trim();
    const password = form.querySelector('#password')?.value || '';

    if (!username || !password) {
      if (errorBox) {
        errorBox.hidden = false;
        errorBox.textContent =
          'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.';
      }
      return;
    }

    try {
      setLoading(submitBtn, true);

      const res = await api('/auth/login', {
        method: 'POST',
        body: { username, password },
      });

      const token = res?.data?.token ?? res?.token;
      const user = res?.data?.user ?? res?.user ?? null;

      if (!token || !user)
        throw new Error('Không nhận được token hoặc user từ máy chủ.');

      // ✅ Lưu token và user
      setToken(token);
      saveUser(user);

      const role = mapRole(user);
      console.log('Đăng nhập thành công:', { role, user });

      // ✅ Điều hướng theo quyền
      switch (role) {
        case 'admin':
        case 'manager':
          window.location.href = './nhan-vien.html';
          break;
        case 'employee':
          window.location.href = './trang-chinh.html';
          break;
        default:
          window.location.href = './403.html';
          break;
      }
    } catch (err) {
      let msg = err?.message || 'Đăng nhập thất bại.';
      if (err?.status === 401) msg = 'Sai tên đăng nhập hoặc mật khẩu.';
      if (err?.status === 429)
        msg = 'Đăng nhập quá nhiều lần. Vui lòng thử lại sau ít phút.';
      if (errorBox) {
        errorBox.hidden = false;
        errorBox.textContent = msg;
      }
    } finally {
      setLoading(submitBtn, false);
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
