// frontend/public/assets/js/auth.js
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

function mapRole(user) {
  const raw = user?.role ?? user?.quyen ?? user?.permission ?? '';
  if (raw === 'nhanvien') return 'employee';
  return raw; // admin | manager | employee
}

async function init() {
  // Hiển thị năm ở footer (nếu có)
  const y = document.getElementById('y');
  if (y) y.textContent = new Date().getFullYear();

  // Kiểm tra /health để báo tình trạng
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

      // Gọi API đăng nhập
      const data = await api('/auth/login', {
        method: 'POST',
        body: { username, password },
      });

      // Linh hoạt lấy token & user tuỳ backend trả về
      const token = data?.data?.token ?? data?.token;
      const user = data?.data?.user ?? data?.user ?? null;

      if (!token) throw new Error('Không nhận được token từ máy chủ.');

      setToken(token);
      saveUser(user);

      // Điều hướng theo role
      const role = mapRole(user);
      if (role === 'admin' || role === 'manager') {
        window.location.href = './nhan-vien.html';
      } else if (role === 'employee') {
        window.location.href = './trang-chinh.html';
      } else {
        // không rõ role → cho về 403 để an toàn
        window.location.href = './403.html';
      }
    } catch (err) {
      // Hiển thị lỗi thân thiện
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
