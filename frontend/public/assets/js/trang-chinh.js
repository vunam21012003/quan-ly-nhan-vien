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
    const attr = el.getAttribute('data-role');
    if (!attr) return;

    if (attr === 'staff') {
      el.hidden = false;
      return;
    }

    const roles = attr
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);

    el.hidden = !roles.includes(role);
  });
}

// ========= RENDER KPI CHUNG =========
function renderKPIs(staff) {
  $('#kpi-total') &&
    ($('#kpi-total').textContent = (staff?.total ?? 0).toString());
  $('#kpi-present') &&
    ($('#kpi-present').textContent = (staff?.present ?? 0).toString());
  $('#kpi-absent') &&
    ($('#kpi-absent').textContent = (staff?.absent ?? 0).toString());
  $('#kpi-unlawful') &&
    ($('#kpi-unlawful').textContent = (staff?.unlawful ?? 0).toString());
}

// ========= BIỂU ĐỒ LƯƠNG THEO PHÒNG BAN =========
function renderSalaryChart(salary) {
  const container = $('#salaryChart');
  if (!container) return;

  container.innerHTML = '';

  const list = salary?.by_department || [];
  if (!list.length) {
    container.innerHTML =
      '<p class="text-muted">Chưa có dữ liệu lương tháng trước.</p>';
    return;
  }

  const max = Math.max(...list.map((d) => Number(d.total_salary || 0)), 1);

  list.forEach((d) => {
    const total = Number(d.total_salary || 0);
    const height = (total / max) * 100;

    // Format số tiền thành tỷ hoặc triệu
    let displayValue = '';
    if (total >= 1000000000) {
      displayValue = (total / 1000000000).toFixed(1) + 'B';
    } else if (total >= 1000000) {
      displayValue = (total / 1000000).toFixed(0) + 'M';
    } else {
      displayValue = total.toLocaleString('vi-VN');
    }

    const bar = document.createElement('div');
    bar.className = 'salary-bar';

    const valueEl = document.createElement('div');
    valueEl.className = 'salary-value';
    valueEl.textContent = displayValue;

    const innerEl = document.createElement('div');
    innerEl.className = 'salary-bar-inner';
    innerEl.style.height = `${height}%`;

    const labelEl = document.createElement('div');
    labelEl.className = 'salary-label';
    labelEl.textContent = d.ten_phong_ban || 'Không rõ';
    labelEl.title = d.ten_phong_ban; // Tooltip khi hover

    bar.appendChild(valueEl);
    bar.appendChild(innerEl);
    bar.appendChild(labelEl);

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

    // Format số tiền
    let displayValue = '';
    if (item.value >= 1000000) {
      displayValue = (item.value / 1000000).toFixed(1) + 'M';
    } else if (item.value >= 1000) {
      displayValue = (item.value / 1000).toFixed(0) + 'K';
    } else {
      displayValue = item.value.toLocaleString('vi-VN');
    }

    const bar = document.createElement('div');
    bar.className = 'reward-bar';

    const valueEl = document.createElement('div');
    valueEl.className = 'reward-value';
    valueEl.textContent = displayValue;

    const innerEl = document.createElement('div');
    innerEl.className = `reward-bar-inner ${item.type}`;
    innerEl.style.height = `${height}%`;

    const labelEl = document.createElement('div');
    labelEl.className = 'reward-label';
    labelEl.textContent = item.label;

    bar.appendChild(valueEl);
    bar.appendChild(innerEl);
    bar.appendChild(labelEl);

    container.appendChild(bar);
  });
}

// ========= TOP NHÂN VIÊN (DANH SÁCH) =========
function renderTopEmployees(employees) {
  const ul = $('#topEmployeesList');
  if (!ul) return;

  ul.innerHTML = '';

  if (!employees || !employees.length) {
    ul.innerHTML =
      '<li class="text-muted" style="padding:6px 0;">Chưa có dữ liệu</li>';
    return;
  }

  employees.slice(0, 5).forEach((e, idx) => {
    const net = Number(e.net_contribution_score || 0);
    const isPositive = net >= 0;

    const li = document.createElement('li');
    li.className = 'top-item';
    li.innerHTML = `
      <div class="top-main">
        <span class="top-rank">${idx + 1}</span>
        <div class="top-info">
          <span class="top-name">${e.ho_ten || 'Không rõ'}</span>
          <span class="top-meta">${e.ten_phong_ban || ''}</span>
        </div>
      </div>
      <span class="top-score ${
        isPositive ? 'score-positive' : 'score-negative'
      }">
        ${isPositive ? '+' : ''}${net.toLocaleString('vi-VN')} đ
      </span>
    `;
    ul.appendChild(li);
  });
}

// ========= BIỂU ĐỒ TOP NHÂN VIÊN (VERTICAL BAR) =========
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

  // Chuẩn bị dữ liệu
  const scores = list.map((e) => Number(e.net_contribution_score || 0));
  const maxScore = Math.max(...scores, 1);
  const minScore = Math.min(...scores, 0);
  const absMax = Math.max(Math.abs(maxScore), Math.abs(minScore)) || 1;

  // Wrapper container với class
  const wrapper = document.createElement('div');
  wrapper.className = 'top-chart-container';

  list.forEach((e, idx) => {
    const net = Number(e.net_contribution_score || 0);
    const relativeHeight = Math.abs(net / absMax) * 40;
    const isPositive = net >= 0;

    const bar = document.createElement('div');
    bar.className = `vertical-bar ${
      isPositive ? 'vertical-bar-positive' : 'vertical-bar-negative'
    }`;

    const barValue = document.createElement('div');
    barValue.className = `bar-value ${isPositive ? 'positive' : 'negative'}`;
    barValue.textContent = net.toLocaleString('vi-VN');

    const barInner = document.createElement('div');
    barInner.className = `bar-inner ${isPositive ? 'positive' : 'negative'}`;
    barInner.style.height = `${relativeHeight}%`;

    const barLabel = document.createElement('div');
    barLabel.className = 'bar-label';
    barLabel.textContent = `Rank ${idx + 1}`;

    bar.appendChild(barValue);
    bar.appendChild(barInner);
    bar.appendChild(barLabel);

    wrapper.appendChild(bar);
  });

  container.appendChild(wrapper);
}

// ========= NGÀY LỄ =========
function renderHolidays(holidays) {
  const box = $('#holidaysList');
  if (!box) return;

  box.innerHTML = '';

  if (!holidays || !holidays.length) {
    box.innerHTML =
      '<li class="text-muted" style="padding:6px 0;">Không có ngày lễ sắp tới</li>';
    return;
  }

  holidays.forEach((h) => {
    const li = document.createElement('li');
    li.className = 'holiday-item';
    li.innerHTML = `
      <div class="holiday-date">${h.ngay}</div>
      <div class="holiday-info">
        <div class="holiday-name">${h.ten_ngay}</div>
        <div class="holiday-meta">${h.so_ngay_nghi} ngày nghỉ</div>
      </div>
    `;
    box.appendChild(li);
  });
}

// ========= BLOCK DÀNH CHO EMPLOYEE =========
function renderEmployeeBlocks(role, data) {
  if (role !== 'employee') return;

  const hours = data.hours?.total_hours ?? 0;
  const salaryTotal = data.salary?.current_total ?? 0;

  $('#emp-hours') &&
    ($('#emp-hours').textContent = hours.toLocaleString('vi-VN') + ' giờ');

  $('#emp-salary') &&
    ($('#emp-salary').textContent = salaryTotal.toLocaleString('vi-VN') + ' đ');
}

// ========= INIT =========
async function initDashboard() {
  const user = getUser();
  const role = getCurrentRole();

  const helloEl = $('#helloName');
  if (helloEl) {
    helloEl.textContent = user?.ho_ten || user?.username || 'Bạn';
  }
  const todayEl = $('#today-date');
  if (todayEl) {
    todayEl.textContent = new Date().toLocaleDateString('vi-VN');
  }

  // Ẩn/hiện theo role
  applyRoleVisibility(role);

  // Gọi API backend
  try {
    const data = await api('/api/trang-chinh/complete');

    renderKPIs(data.staff);
    renderSalaryChart(data.salary);
    renderRewardChart(data.rewards);

    // Gọi cả hai hàm để render danh sách và biểu đồ
    renderTopEmployees(data.rewards?.by_employee || []);
    renderTopEmployeesChart(data.rewards?.by_employee || []);

    renderHolidays(data.holidays || []);
    renderEmployeeBlocks(role, data);
  } catch (err) {
    console.error('Lỗi tải dữ liệu trang chính:', err);
  }
}

document.addEventListener('DOMContentLoaded', initDashboard);
