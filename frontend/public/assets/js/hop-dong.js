const API_URL = 'http://localhost:3000/api/hopdong'; // chỉnh lại URL theo backend

const tableBody = document.querySelector('#contractsTable tbody');
const btnAdd = document.getElementById('btnAdd');
const modal = document.getElementById('contractModal');
const closeModal = document.querySelector('.close');
const form = document.getElementById('contractForm');
const modalTitle = document.getElementById('modalTitle');
const contractId = document.getElementById('contractId');

// Mở modal thêm hợp đồng
btnAdd.onclick = () => {
  modal.style.display = 'block';
  modalTitle.textContent = 'Thêm hợp đồng';
  form.reset();
  contractId.value = '';
};

// Đóng modal
closeModal.onclick = () => (modal.style.display = 'none');
window.onclick = (e) => {
  if (e.target == modal) modal.style.display = 'none';
};

// Load danh sách hợp đồng
async function loadContracts() {
  const res = await fetch(API_URL);
  const data = await res.json();

  tableBody.innerHTML = '';
  data.forEach((c) => {
    const row = `
      <tr>
        <td>${c.id}</td>
        <td>${c.nhan_vien_id}</td>
        <td>${c.loai_hop_dong}</td>
        <td>${c.ngay_bat_dau}</td>
        <td>${c.ngay_ket_thuc}</td>
        <td>${c.luong_co_ban}</td>
        <td>${c.trang_thai}</td>
        <td>
          <button onclick="editContract('${c.id}')">✏️</button>
          <button onclick="deleteContract('${c.id}')">🗑️</button>
        </td>
      </tr>
    `;
    tableBody.innerHTML += row;
  });
}

// Lưu hợp đồng (thêm/sửa)
form.onsubmit = async (e) => {
  e.preventDefault();
  const payload = {
    nhan_vien_id: form.nhan_vien_id.value,
    loai_hop_dong: form.loai_hop_dong.value,
    ngay_bat_dau: form.ngay_bat_dau.value,
    ngay_ket_thuc: form.ngay_ket_thuc.value,
    luong_co_ban: form.luong_co_ban.value,
    trang_thai: form.trang_thai.value,
  };

  if (contractId.value) {
    await fetch(`${API_URL}/${contractId.value}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } else {
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  modal.style.display = 'none';
  loadContracts();
};

// Sửa hợp đồng
async function editContract(id) {
  const res = await fetch(`${API_URL}/${id}`);
  const c = await res.json();

  modal.style.display = 'block';
  modalTitle.textContent = 'Sửa hợp đồng';
  contractId.value = c.id;

  form.nhan_vien_id.value = c.nhan_vien_id;
  form.loai_hop_dong.value = c.loai_hop_dong;
  form.ngay_bat_dau.value = c.ngay_bat_dau.split('T')[0];
  form.ngay_ket_thuc.value = c.ngay_ket_thuc.split('T')[0];
  form.luong_co_ban.value = c.luong_co_ban;
  form.trang_thai.value = c.trang_thai;
}

// Xoá hợp đồng
async function deleteContract(id) {
  if (confirm('Bạn có chắc muốn xoá hợp đồng này?')) {
    await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    loadContracts();
  }
}

// Gọi khi load trang
loadContracts();
