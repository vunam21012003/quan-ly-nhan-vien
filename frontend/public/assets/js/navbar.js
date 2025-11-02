import { getUser, clearAuth } from './api.js';

fetch('danh-sach.html')
  .then((res) => res.text())
  .then((html) => {
    document.getElementById('menuContainer').innerHTML = html;

    const u = getUser();
    console.log('User hiện tại:', u);

    // ✅ Thêm link quản trị nếu là admin
    if (u && u.role === 'admin') {
      const userBadge = document.getElementById('user-badge');
      if (userBadge) {
        userBadge.insertAdjacentHTML(
          'beforebegin',
          `
          <a class="btn" href="./phong-ban.html">Phòng ban</a>
          <a class="btn" href="./chuc-vu.html">Chức vụ</a>
          <a class="btn" href="./tai-khoan.html">Tài khoản</a>
        `
        );
      }
    }

    // ✅ Đăng xuất
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn?.addEventListener('click', () => {
      clearAuth();
      window.location.replace('dang-nhap.html');
    });
  })
  .catch((err) => {
    console.error('Lỗi load navbar:', err);
  });
