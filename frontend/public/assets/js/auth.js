const form = document.getElementById("loginForm");
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const fd = new FormData(form);
  const body = {
    username: fd.get("username"),
    password: fd.get("password"),
  };

  try {
    const res = await api.post("/auth/login", body, { auth: false }); // 👈 thêm auth: false
    localStorage.setItem("token", res.token);
    localStorage.setItem("user", JSON.stringify(res.user));

    window.location.href = "./trangchinh.html"; // 👈 đổi đúng tên file
  } catch (err) {
    document.getElementById("loginError").textContent =
      err.message || "Đăng nhập thất bại";
  }
});
