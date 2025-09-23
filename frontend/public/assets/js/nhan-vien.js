let employees = [];
let editingId = null;

function renderTable() {
  const tbody = document.getElementById('employeeTableBody');
  tbody.innerHTML = '';

  employees.forEach((emp, index) => {
    const row = `<tr>
      <td>${index + 1}</td>
      <td>${emp.name}</td>
      <td>${emp.email}</td>
      <td>${emp.position}</td>
      <td>${emp.department}</td>
      <td>
        <button class="btn btn-warning btn-sm" onclick="editEmployee('${
          emp.id
        }')">Sửa</button>
        <button class="btn btn-danger btn-sm" onclick="deleteEmployee('${
          emp.id
        }')">Xoá</button>
      </td>
    </tr>`;
    tbody.innerHTML += row;
  });
}

function openForm() {
  editingId = null;
  document.getElementById('formTitle').innerText = 'Thêm nhân viên';
  document.getElementById('employeeForm').reset();
  document.getElementById('employeeId').value = '';
  document.getElementById('employeeModal').classList.add('show');
}

function closeForm() {
  document.getElementById('employeeModal').classList.remove('show');
}

function submitForm(e) {
  e.preventDefault();

  const id =
    document.getElementById('employeeId').value || Date.now().toString();
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const position = document.getElementById('position').value.trim();
  const department = document.getElementById('department').value.trim();

  const newData = { id, name, email, position, department };

  if (editingId) {
    const index = employees.findIndex((emp) => emp.id === editingId);
    if (index !== -1) employees[index] = newData;
  } else {
    employees.push(newData);
  }

  closeForm();
  renderTable();
}

function editEmployee(id) {
  const emp = employees.find((emp) => emp.id === id);
  if (!emp) return;

  editingId = id;

  document.getElementById('employeeId').value = emp.id;
  document.getElementById('name').value = emp.name;
  document.getElementById('email').value = emp.email;
  document.getElementById('position').value = emp.position;
  document.getElementById('department').value = emp.department;

  document.getElementById('formTitle').innerText = 'Chỉnh sửa nhân viên';
  document.getElementById('employeeModal').classList.add('show');
}

function deleteEmployee(id) {
  if (confirm('Bạn có chắc muốn xoá nhân viên này không?')) {
    employees = employees.filter((emp) => emp.id !== id);
    renderTable();
  }
}

window.onload = renderTable;
