import { currentUser, api } from './api.js';
// Giả định navbar.js cũng cung cấp logic xử lý menu và logout

/**
 * Khởi tạo logic phân quyền và tải dữ liệu cho trang chính (Dashboard).
 */
export function initDashboard() {
  const user = currentUser();
  document.getElementById('helloName').textContent = user?.username || '';

  // --- PHÂN QUYỀN HIỂN THỊ KHỐI DASHBOARD ---
  const adminManagerDash = document.getElementById('adminManagerDashboard');
  const employeeDash = document.getElementById('employeeDashboard');

  if (user.role === 'admin' || user.role === 'manager') {
    adminManagerDash.style.display = 'flex';
    loadAdminManagerStats();
  } else if (user.role === 'employee') {
    employeeDash.style.display = 'flex';
    loadEmployeeStats();
  }

  // --- LOGIC GẮN LINKS VÀO NAVBAR (Nếu cần, có thể chuyển vào navbar.js) ---
  // (Giữ lại logic cũ của bạn)
  // const nav = document.querySelector('.navbar-nav');
  // const links = [ /* ... */ ];
  // links.forEach(/* ... */);
}

/**
 * Gọi API lấy thống kê cho Admin/Manager.
 */
async function loadAdminManagerStats() {
  try {
    const data = await api.get('/thong-ke/dashboard', { auth: true });
    document.getElementById('statNV').textContent = data.totalEmployees || '0';
    document.getElementById('statPending').textContent =
      data.pendingRequests || '0';
    document.getElementById('statAbsent').textContent = data.absentToday || '0';
  } catch (err) {
    console.error('Lỗi tải thống kê Admin:', err);
  }
}

/**
 * Gọi API lấy thống kê cá nhân cho Employee.
 */
async function loadEmployeeStats() {
  try {
    const data = await api.get('/thong-ke/user-info', { auth: true });
    document.getElementById('statPhep').textContent =
      data.remainingLeaveDays || '—';
    document.getElementById('statLuong').textContent =
      data.lastSalaryAmount || '—';
  } catch (err) {
    console.error('Lỗi tải thống kê cá nhân:', err);
  }
}

// Chạy khởi tạo ngay khi file được load
initDashboard();
