import { getUser, clearAuth } from './api.js';

// Tải navbar HTML
fetch('danh-sach.html')
  .then((res) => res.text())
  .then((html) => {
    const menuContainer = document.getElementById('menuContainer');
    if (menuContainer) {
      menuContainer.innerHTML = html;
    }

    // ===== LẤY THÔNG TIN USER & RENDER =====
    const user = getUser();
    console.log('User hiện tại:', user);

    if (user) {
      // Cập nhật user badge
      const userInfo = document.getElementById('user-info');
      const userBadge = document.getElementById('user-badge');
      if (userInfo) {
        userInfo.textContent = user.ho_ten || user.username || 'User';
      }
      if (userBadge) {
        userBadge.classList.remove('badge-muted');
        userBadge.classList.add('badge-primary');
      }

      // Đánh dấu menu active theo trang hiện tại
      document.querySelectorAll('.nav-link').forEach((link) => {
        if (
          link.getAttribute('href') ===
          window.location.pathname.split('/').pop()
        ) {
          link.classList.add('active');
        }
      });

      // ===== ẨNHIỆN ADMIN MENU DỰA TRÊN ROLE =====
      const adminMenu = document.querySelector('.admin-menu');
      if (adminMenu) {
        if (user.role === 'admin') {
          adminMenu.style.display = 'flex'; // Hiển thị nếu là admin
        } else {
          adminMenu.style.display = 'none'; // Ẩn nếu không phải admin
        }
      }
      const salaryMenu = document.querySelector('a[href="./luong.html"]');
      if (salaryMenu) {
        if (user.role === 'employee') {
          salaryMenu.style.display = 'none'; // 👈 NHÂN VIÊN KHÔNG THẤY
        }
      }
    }

    // ===== LOGOUT HANDLER =====
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        clearAuth();
        window.location.replace('./dang-nhap.html');
      });
    }
  })
  .catch((err) => {
    console.error('Lỗi load navbar:', err);
  });
