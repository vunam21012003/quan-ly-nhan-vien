// frontend/public/assets/js/api.js
// Cấu hình 1 chỗ để đổi nhanh khi deploy:
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
// Hỗ trợ JSON và FormData
export async function api(
  path,
  { method = 'GET', body, headers, formData = false } = {}
) {
  const finalHeaders = {
    ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    ...headers,
  };

  // Nếu không phải FormData thì mới set Content-Type JSON
  if (!formData) {
    finalHeaders['Content-Type'] = 'application/json';
  }

  const res = await fetch(API_BASE + path, {
    method,
    headers: finalHeaders,
    body: body
      ? formData
        ? body // FormData giữ nguyên
        : JSON.stringify(body)
      : undefined,
  });

  // Cố gắng parse JSON, nếu lỗi giữ object rỗng
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

// ==== Gọi /health để hiện badge ====
export async function healthCheck() {
  try {
    const res = await fetch(API_BASE + '/health');
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && !!data?.db?.ok, data };
  } catch {
    return { ok: false, data: null };
  }
}

// ==== Tiện ích cho trang khác ====
// Nếu chưa đăng nhập thì redirect
export function requireAuthOrRedirect(to = './dang-nhap.html') {
  if (!getToken()) location.href = to;
}

// ==== Logout tiện ích ====
// Xoá token và user, redirect về login
export function logout() {
  clearAuth();
}
