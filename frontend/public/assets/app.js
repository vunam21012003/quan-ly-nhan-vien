const API_BASE = "http://localhost:8001";

const api = {
  async request(path, { method = "GET", body, auth = false } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (auth) {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Chưa đăng nhập");
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(msg || `HTTP ${res.status}`);
    }

    if (res.status === 204) return null;
    return res.json();
  },

  get: (p, opt) => api.request(p, { ...opt, method: "GET" }),
  post: (p, body, opt) => api.request(p, { ...opt, method: "POST", body }),
  put: (p, body, opt) => api.request(p, { ...opt, method: "PUT", body }),
  del: (p, opt) => api.request(p, { ...opt, method: "DELETE" }),
};

// Guard cho trang bảo vệ
function requireAuth(roles = []) {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");
  if (!token || !user) {
    window.location.replace("./index.html");
    return;
  }
  if (roles.length && !roles.includes(user.role)) {
    window.location.replace("./403.html");
  }
}

// UI helpers
function currentUser() {
  return JSON.parse(localStorage.getItem("user") || "null");
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.replace("./index.html");
}
