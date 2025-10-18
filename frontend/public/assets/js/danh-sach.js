// Tải menu từ danh-sach.html vào #menuContainer
fetch('danh-sach.html')
  .then((res) => res.text())
  .then((html) => {
    document.getElementById('menuContainer').innerHTML = html;

    // Đánh dấu menu đang active theo trang hiện tại
    document.querySelectorAll('.nav-link').forEach((a) => {
      if (a.href === window.location.href) {
        a.classList.add('active');
      }
    });

    // Xử lý nút đăng xuất (nếu có)
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token'); // hoặc clearAuth() nếu bạn có hàm này
        window.location.href = './dang-nhap.html';
      });
    }
  })
  .catch((err) => console.error('Không load được menu:', err));
