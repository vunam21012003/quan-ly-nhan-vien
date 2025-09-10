(async function () {
  // List
  const data = await api.get("/nhan-vien?page=1&limit=50");
  const tbody = document.querySelector("#tblNV tbody");
  (data.items || data.rows || []).forEach((nv, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${nv.ho_ten || nv.ten || ""}</td>
      <td>${nv.phong_ban || nv.phongBan || ""}</td>
      <td>${nv.chuc_vu || nv.chucVu || ""}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-secondary me-2" data-id="${
          nv.id
        }">Sửa</button>
        <button class="btn btn-sm btn-outline-danger" data-del="${
          nv.id
        }">Xóa</button>
      </td>`;
    tbody.appendChild(tr);
  });

  // Xóa (admin)
  document.addEventListener("click", async (e) => {
    if (e.target.matches("button[data-del]")) {
      const id = e.target.getAttribute("data-del");
      if (confirm("Xóa nhân viên này?")) {
        await api.del(`/nhan-vien/${id}`);
        location.reload();
      }
    }
  });
})();
