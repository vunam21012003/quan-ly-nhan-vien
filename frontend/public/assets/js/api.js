//api.js
export const API_BASE = window.API_BASE || 'http://localhost:8001';

// ==== Lưu/Lấy token & user trong localStorage ====
const TOKEN_KEY = 'hr_token';
const USER_KEY = 'hr_user';

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
}
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function saveUser(user) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user || null));
  } catch {}
}
export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}
export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// ==== Wrapper fetch chuẩn hoá ====
// Tự động đính kèm token & xử lý lỗi JSON
export async function api(
  path,
  { method = 'GET', body, headers, formData = false } = {}
) {
  const isFormData = formData || body instanceof FormData;

  const finalHeaders = {
    ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    ...headers,
  };

  if (!isFormData) {
    finalHeaders['Content-Type'] = 'application/json';
  }

  const options = {
    method,
    headers: finalHeaders,
  };

  // FIX CHÍNH: KHÔNG BAO GIỜ set body trong GET hoặc HEAD
  if (method !== 'GET' && method !== 'HEAD') {
    if (body) {
      options.body = isFormData ? body : JSON.stringify(body);
    }
  }

  const res = await fetch(API_BASE + path, options);

  let data = {};
  try {
    data = await res.json();
  } catch {}

  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ==== Gọi /health để kiểm tra hệ thống ====
export async function healthCheck() {
  try {
    const res = await fetch(API_BASE + '/health');
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: null };
  }
}

// ==== Tiện ích bảo vệ trang ====
export async function requireAuthOrRedirect(to = './dang-nhap.html') {
  const token = getToken();

  if (!token) {
    location.href = to;
    return;
  }

  // Gọi /auth/me để lấy quyền mới nhất
  try {
    const me = await api('/auth/me');
    saveUser(me);
  } catch (err) {
    clearAuth();
    location.href = to;
  }
}

// ==== Đăng xuất nhanh ====
export function logout() {
  clearAuth();
  window.location.replace('./dang-nhap.html');
}
