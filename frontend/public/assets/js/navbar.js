import { getUser } from './api.js';

fetch('danh-sach.html')
  .then((res) => res.text())
  .then((html) => {
    document.getElementById('menuContainer').innerHTML = html;

    const u = getUser();
    console.log('User hiện tại:', u);

    // ✅ Nếu là admin → thêm link vào trước user-badge
    if (u && (u.role === 'admin' || u.quyen === 'admin')) {
      const userBadge = document.getElementById('user-badge');
      if (userBadge) {
        userBadge.insertAdjacentHTML(
          'beforebegin',
          `
          <a class="btn" href="./phong-ban.html">Phòng ban</a>
          <a class="btn" href="./chuc-vu.html">Chức vụ</a>
        `
        );
      }
    }

    // 🔑 Đăng xuất
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn?.addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.replace('dangnhap.html');
    });
  })
  .catch((err) => {
    console.error('Lỗi load navbar:', err);
  });
