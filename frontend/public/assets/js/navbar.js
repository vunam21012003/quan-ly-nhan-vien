// navbar.js
import { api, getUser, clearAuth } from './api.js';

// Tải navbar HTML
fetch('danh-sach.html')
  .then((res) => res.text())
  .then((html) => {
    const menuContainer = document.getElementById('menuContainer');
    if (!menuContainer) return;

    menuContainer.innerHTML = html;

    // ===== LẤY THÔNG TIN USER & RENDER =====
    const user = getUser();

    if (user) {
      // Cập nhật user badge
      const userInfo = document.getElementById('user-info');
      const userBadge = document.getElementById('user-badge');

      if (userInfo)
        userInfo.textContent = user.ho_ten || user.username || 'User';
      if (userBadge) {
        userBadge.classList.remove('badge-muted');
        userBadge.classList.add('badge-primary');
      }

      // Active menu
      document.querySelectorAll('.nav-link').forEach((link) => {
        if (
          link.getAttribute('href') ===
          window.location.pathname.split('/').pop()
        ) {
          link.classList.add('active');
        }
      });

      // Admin menu
      const adminMenu = document.querySelector('.admin-menu');
      if (adminMenu) {
        adminMenu.style.display = user.role === 'admin' ? 'flex' : 'none';
      }

      // Salary menu
      const salaryMenu = document.querySelector('a[href="./luong.html"]');
      if (salaryMenu && user.role === 'employee') {
        salaryMenu.style.display = 'none';
      }
    }

    // ===== LOGOUT =====
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        clearAuth();
        window.location.replace('./dang-nhap.html');
      });
    }

    // ===================== Thanh cuốn ngang ================================
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu) {
      let isDown = false;
      let startX;
      let scrollLeft;
      let hasMoved = false;

      navMenu.addEventListener('mousedown', (e) => {
        isDown = true;
        hasMoved = false;
        startX = e.pageX - navMenu.offsetLeft;
        scrollLeft = navMenu.scrollLeft;
      });
      navMenu.addEventListener('mouseleave', () => {
        isDown = false;
      });
      navMenu.addEventListener('mouseup', () => {
        isDown = false;
        setTimeout(() => {
          hasMoved = false;
        }, 10);
      });
      navMenu.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        hasMoved = true;
        const x = e.pageX - navMenu.offsetLeft;
        const walk = (x - startX) * 2.5;
        navMenu.scrollLeft = scrollLeft - walk;
      });
      navMenu.addEventListener(
        'click',
        (e) => {
          if (hasMoved) {
            e.preventDefault();
            e.stopPropagation();
          }
        },
        true
      );
    }

    // =====================================================
    // MODULE THÔNG BÁO
    // =====================================================

    async function loadNotifications() {
      const user = getUser();
      if (!user) return;

      try {
        // 1. Chống Cache (Bắt buộc để tránh lỗi 304 không update trạng thái)
        const noCacheUrl = `/api/trang-chinh/complete?t=${new Date().getTime()}`;
        const data = await api(noCacheUrl);
        const list = data.notifications || [];

        // 2. Logic Đếm số (Kết hợp code cũ & mới)
        let unreadCount = list.filter((n) => {
          const s = n.trang_thai ? String(n.trang_thai).toLowerCase() : '';
          return s === 'chua_doc' || !s; // !s nghĩa là null hoặc rỗng
        }).length;

        if (unreadCount === 0 && list.length > 0) {
        }

        // 3. Hiển thị Badge
        const countEl = document.getElementById('notify-count');
        if (countEl) {
          countEl.textContent = unreadCount;
          if (unreadCount > 0) {
            countEl.classList.remove('hidden');
            countEl.style.display = 'flex';
          } else {
            countEl.classList.add('hidden');
            countEl.style.display = 'none';
          }
        }

        // 4. Render Dropdown
        const drop = document.getElementById('notify-dropdown');
        if (!drop) return;
        drop.innerHTML = '';

        if (!list.length) {
          drop.innerHTML =
            '<p style="text-align:center;padding:12px;color:#666">Không có thông báo</p>';
          return;
        }

        list.slice(0, 15).forEach((n) => {
          const item = document.createElement('div');
          item.className = 'notify-item';

          // Kiểm tra xem tin này có được coi là chưa đọc không
          const s = n.trang_thai ? String(n.trang_thai).toLowerCase() : '';
          const isUnread = s === 'chua_doc' || !s; // Chưa đọc hoặc null

          // Màu nền: Trắng (chưa đọc) / Xám (đã đọc)
          const bgColor = isUnread ? '#ffffff' : '#f9f9f9';
          const textColor = isUnread ? '#000' : '#666';

          item.style.cssText = `
            background-color: ${bgColor};
            color: ${textColor};
            padding: 12px;
            border-bottom: 1px solid #eee;
            cursor: pointer;
            transition: all 0.2s;
          `;

          item.innerHTML = `
            <div style="pointer-events: none;">
              <strong>${n.tieu_de}</strong><br/>
              <small>${n.noi_dung || ''}</small><br/>
              <small style="color:#888; font-size: 11px;">
                ${new Date(n.created_at).toLocaleString('vi-VN')}
              </small>
            </div>
          `;

          // --- SỰ KIỆN CLICK (ĐÁNH DẤU ĐÃ ĐỌC) ---
          item.addEventListener('click', async () => {
            if (isUnread) {
              // Đổi màu ngay lập tức
              item.style.backgroundColor = '#f9f9f9';
              item.style.color = '#666';

              // Giảm số trên badge
              if (countEl) {
                let current = parseInt(countEl.textContent) || 0;
                if (current > 0) {
                  countEl.textContent = current - 1;
                  if (current - 1 === 0) countEl.style.display = 'none';
                }
              }

              try {
                // Gọi API PUT
                await api(`/thong-bao/doc/${n.id}`, { method: 'PUT' });
                n.trang_thai = 'da_doc'; // Cập nhật biến local
              } catch (err) {
                console.error('Lỗi API Update:', err);
              }
            }

            // Scroll tới dashboard
            const section = document.getElementById('dashboard-notify-section');
            if (section)
              section.scrollIntoView({ behavior: 'smooth', block: 'start' });

            // Đóng dropdown
            const drop = document.getElementById('notify-dropdown');
            if (drop) drop.classList.add('hidden');
          });

          drop.appendChild(item);
        });
      } catch (err) {
        console.error('Lỗi load thông báo:', err);
      }
    }

    // Toggle dropdown
    document.addEventListener('click', (e) => {
      const btn = document.getElementById('notify-btn');
      const drop = document.getElementById('notify-dropdown');
      if (!btn || !drop) return;
      if (btn.contains(e.target)) {
        drop.classList.toggle('hidden');
      } else if (!drop.contains(e.target)) {
        drop.classList.add('hidden');
      }
    });

    setTimeout(loadNotifications, 500);
    setInterval(loadNotifications, 30000);
  })
  .catch((err) => {
    console.error('Lỗi load navbar:', err);
  });
