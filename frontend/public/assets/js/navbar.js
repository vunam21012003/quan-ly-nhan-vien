fetch('navbar.html')
  .then((res) => res.text())
  .then((html) => {
    document.getElementById('menuContainer').innerHTML = html;

    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn?.addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.replace('dangnhap.html');
    });
  });
