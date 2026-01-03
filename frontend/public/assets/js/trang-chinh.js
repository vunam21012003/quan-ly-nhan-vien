// /assets/js/trang-chinh.js
import { api, getUser, requireAuthOrRedirect } from './api.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

requireAuthOrRedirect();

// ========= LẤY ROLE NGƯỜI DÙNG =========
function getCurrentRole() {
  const user = getUser();
  return user?.role || user?.quyen_mac_dinh || user?.vai_tro || 'employee';
}

// ========= ẨN / HIỆN BLOCK THEO data-role =========
function applyRoleVisibility(role) {
  $$('[data-role]').forEach((el) => {
    const need = el.getAttribute('data-role');
    if (!need) return;

    const roleList = need
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);

    // Hiện nếu data-role chứa 'all' hoặc chứa đúng role hiện tại
    el.hidden = !(roleList.includes('all') || roleList.includes(role));
  });
}

// ========= RENDER CẢNH BÁO =========
function renderAlerts(alerts) {
  const box = $('#alertSection');
  if (!box) return;

  // Nếu phần tử chỉ dành cho admin nhưng user hiện tại không phải admin thì ẩn luôn
  const role = getCurrentRole();
  const need = box.getAttribute('data-role') || '';
  const roleList = need
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);

  if (!(roleList.includes('all') || roleList.includes(role))) {
    box.style.display = 'none';
    return;
  }

  if (!alerts || alerts.length === 0) {
    box.style.display = 'none';
    return;
  }

  box.style.display = 'block';
  box.innerHTML = alerts
    .map(
      (a) =>
        `<div style="margin-bottom:6px"><span class="warning-icon"></span> ${a}</div>`
    )
    .join('');
}

// ========= KPI EMPLOYEE =========
function renderKPIEmployee(data) {
  $('#emp-hours').textContent = (data?.hours ?? '--') + ' giờ';
  $('#emp-days').textContent = data?.days ?? '--';
  $('#emp-late').textContent = data?.late ?? '--';
  $('#emp-leave').textContent = data?.leave ?? '--';
}

// ========= KPI MANAGER =========
function renderKPImanager(data) {
  $('#mgr-pending-leave').textContent = data?.pending_leave ?? '--';
  $('#mgr-ot').textContent = (data?.ot ?? '--') + ' giờ';
}

// ========= KPI ADMIN =========
function renderKPIAdmin(data) {
  $('#adm-total').textContent = data?.total ?? '--';

  const salary = Number(data?.salary || 0);
  $('#adm-salary').textContent = salary.toLocaleString('vi-VN') + ' đ';
}

// ========= BIỂU ĐỒ LƯƠNG THEO PHÒNG BAN =========
function renderSalaryChart(salary) {
  const container = $('#salaryChart');
  if (!container) return;

  container.innerHTML = '';

  const list = salary?.by_department || [];
  if (!list.length) {
    container.innerHTML = '<p class="text-muted">Chưa có dữ liệu lương.</p>';
    return;
  }

  const max = Math.max(...list.map((d) => Number(d.total_salary || 0)), 1);

  list.forEach((d) => {
    const total = Number(d.total_salary || 0);
    const height = (total / max) * 100;

    let displayValue = '';
    if (total >= 1_000_000_000) displayValue = (total / 1e9).toFixed(1) + 'B';
    else if (total >= 1_000_000) displayValue = (total / 1e6).toFixed(0) + 'M';
    else displayValue = total.toLocaleString('vi-VN');

    const bar = document.createElement('div');
    bar.className = 'salary-bar';

    bar.innerHTML = `
      <div class="salary-value">${displayValue}</div>
      <div class="salary-bar-inner" style="height:${height}%"></div>
      <div class="salary-label">${d.ten_phong_ban}</div>
    `;

    container.appendChild(bar);
  });
}

// ========= BIỂU ĐỒ THƯỞNG / PHẠT =========
function renderRewardChart(rewards) {
  const container = $('#rewardChart');
  if (!container) return;
  container.innerHTML = '';

  const rewardTotal = Number(rewards?.reward_total || 0);
  const punishmentTotal = Number(rewards?.punishment_total || 0);

  const max = Math.max(rewardTotal, punishmentTotal, 1);

  const items = [
    { label: 'Thưởng', value: rewardTotal, type: 'reward' },
    { label: 'Phạt', value: punishmentTotal, type: 'punishment' },
  ];

  items.forEach((item) => {
    const height = (item.value / max) * 100;

    let displayValue = '';
    if (item.value >= 1_000_000)
      displayValue = (item.value / 1e6).toFixed(1) + 'M';
    else displayValue = item.value.toLocaleString('vi-VN');

    const bar = document.createElement('div');
    bar.className = 'reward-bar';

    bar.innerHTML = `
      <div class="reward-value">${displayValue}</div>
      <div class="reward-bar-inner ${item.type}" style="height:${height}%"></div>
      <div class="reward-label">${item.label}</div>
    `;

    container.appendChild(bar);
  });
}

// ========= DANH SÁCH TOP NHÂN VIÊN =========
function renderTopEmployees(list) {
  const ul = $('#topEmployeesList');
  if (!ul) return;

  ul.innerHTML = '';

  if (!list || !list.length) {
    ul.innerHTML =
      '<li class="text-muted" style="padding:6px 0;">Chưa có dữ liệu</li>';
    return;
  }

  list.slice(0, 5).forEach((e, idx) => {
    const net = Number(e.net_contribution_score || 0);
    const cls = net >= 0 ? 'score-positive' : 'score-negative';

    const li = document.createElement('li');
    li.className = 'top-item';
    li.innerHTML = `
      <div class="top-main">
        <span class="top-rank">${idx + 1}</span>
        <div class="top-info">
          <span class="top-name">${e.ho_ten}</span>
          <span class="top-meta">${e.ten_phong_ban}</span>
        </div>
      </div>
      <span class="top-score ${cls}">${net.toLocaleString('vi-VN')} đ</span>
    `;
    ul.appendChild(li);
  });
}

// ========= BIỂU ĐỒ TOP NHÂN VIÊN =========
function renderTopEmployeesChart(employees) {
  const container = $('#topEmployeesChart');
  if (!container) return;

  container.innerHTML = '';

  const list = employees?.slice(0, 5) || [];
  if (!list.length) {
    container.innerHTML =
      '<p class="text-muted text-center" style="padding: 50px 0;">Chưa có dữ liệu.</p>';
    return;
  }

  const scores = list.map((e) => Number(e.net_contribution_score || 0));
  const absMax = Math.max(...scores.map((v) => Math.abs(v)), 1);

  const wrapper = document.createElement('div');
  wrapper.className = 'top-chart-container';

  list.forEach((e, idx) => {
    const net = Number(e.net_contribution_score || 0);
    const height = Math.abs(net / absMax) * 40;

    const isPositive = net >= 0;

    const bar = document.createElement('div');
    bar.className = `vertical-bar ${
      isPositive ? 'vertical-bar-positive' : 'vertical-bar-negative'
    }`;

    bar.innerHTML = `
      <div class="bar-value ${
        isPositive ? 'positive' : 'negative'
      }">${net.toLocaleString('vi-VN')}</div>
      <div class="bar-inner ${
        isPositive ? 'positive' : 'negative'
      }" style="height:${height}%"></div>
      <div class="bar-label">Rank ${idx + 1}</div>
    `;

    wrapper.appendChild(bar);
  });

  container.appendChild(wrapper);
}

// ========= PHÊ DUYỆT NHANH (MANAGER) =========
function renderQuickApprove(list) {
  const box = $('#quickApproveList');
  if (!box) return;

  box.innerHTML = '';

  if (!list || list.length === 0) {
    box.innerHTML = `<p class="text-muted">Không có đơn chờ duyệt.</p>`;
    return;
  }

  list.slice(0, 5).forEach((item) => {
    const div = document.createElement('div');
    div.className = 'approve-item';
    div.innerHTML = `
      <b>${item.ho_ten}</b> - ${item.loai_nghi}<br/>
      ${item.ngay_bat_dau} → ${item.ngay_ket_thuc}<br/>
      <div class="approve-actions">
        <button class="btn btn-primary btn-sm">Duyệt</button>
        <button class="btn btn-danger btn-sm">Từ chối</button>
      </div>
    `;
    box.appendChild(div);
  });
}

// ========= THÔNG BÁO GẦN ĐÂY =========
function renderNotifications(list) {
  const ul = $('#notifyList');
  if (!ul) return;

  ul.innerHTML = '';

  if (!list || list.length === 0) {
    ul.innerHTML =
      '<li class="text-muted" style="padding:6px 0;">Không có thông báo</li>';
    return;
  }

  list.slice(0, 5).forEach((n) => {
    const li = document.createElement('li');
    li.className = 'top-item';
    const created = new Date(n.created_at).toLocaleString('vi-VN');

    li.innerHTML = `
      <div class="top-main">
        <div class="top-info">
          <span class="top-name">${n.tieu_de}</span>
          <span class="top-meta">${created}</span>
          ${n.noi_dung ? `<span class="top-meta">${n.noi_dung}</span>` : ''}
          ${
            n.nguoi_tao
              ? `<span class="top-meta">Người thực hiện: ${n.nguoi_tao}</span>`
              : ''
          }
        </div>
      </div>
    `;
    ul.appendChild(li);
  });
}

// ========= INIT DASHBOARD =========
async function initDashboard() {
  const user = getUser();
  const role = getCurrentRole();

  $('#helloName').textContent = user?.ho_ten || user?.username || 'Bạn';
  $('#today-date').textContent = new Date().toLocaleDateString('vi-VN');

  applyRoleVisibility(role);

  try {
    const data = await api('/api/trang-chinh/complete');

    // Cảnh báo
    renderAlerts(data.alerts);

    // KPI theo role
    // KPI theo role
    if (role === 'employee') renderKPIEmployee(data.kpi_employee);
    if (role === 'manager' || role === 'admin')
      renderKPImanager(data.kpi_manager);
    if (role === 'admin') renderKPIAdmin(data.kpi_admin);

    // Biểu đồ
    renderSalaryChart(data.salary);
    renderRewardChart(data.rewards);

    // Top employees
    renderTopEmployees(data.topEmployees);
    renderTopEmployeesChart(data.topEmployees);

    // Phê duyệt nhanh (manager)
    if (role === 'manager') renderQuickApprove(data.quick_approve);

    // Thông báo mới nhất
    renderNotifications(data.notifications);
  } catch (err) {
    console.error('Lỗi tải dashboard:', err);
  }
}

document.addEventListener('DOMContentLoaded', initDashboard);
