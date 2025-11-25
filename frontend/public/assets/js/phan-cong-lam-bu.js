import { api, getUser } from './api.js';

const modal = document.getElementById('phanCongModal');
const danhSachNhanVien = document.getElementById('pc-list');
const ngayText = document.getElementById('pc-ngay');
const saveBtn = document.getElementById('btn-pc-save');
const cancelBtn = document.getElementById('btn-pc-cancel');

// 💡 Thêm biến cho nút "Chọn tất cả" (tạo ngoài hàm để giữ tham chiếu)
const selectAllCheckbox = document.createElement('input');
selectAllCheckbox.type = 'checkbox';
selectAllCheckbox.id = 'pc-select-all';
selectAllCheckbox.style.marginRight = '5px';

// 💡 Hàm xử lý khi click "Chọn tất cả"
function handleSelectAllChange() {
  const isChecked = this.checked;
  // Chỉ chọn các checkbox của nhân viên (không bao gồm chính nó)
  const checkboxes = danhSachNhanVien.querySelectorAll(
    'input[type="checkbox"]:not(#pc-select-all)'
  );
  checkboxes.forEach((cb) => (cb.checked = isChecked));
}

selectAllCheckbox.onchange = handleSelectAllChange;

/**
 * 🧭 Hiển thị popup phân công làm bù
 * @param {string} ngay - Ngày làm bù (YYYY-MM-DD)
 */
export async function openPhanCongModal(ngay) {
  try {
    ngayText.textContent = ngay;

    // Reset "chọn tất cả"
    selectAllCheckbox.checked = false;

    danhSachNhanVien.innerHTML = `
      <div class="pc-select-all-header">
        <label class="pc-label-select-all">
          <input type="checkbox" id="pc-select-all" style="margin-right:5px" />
          <strong>Chọn tất cả nhân viên</strong>
        </label>
      </div>
      <p id="pc-loading-text" class="pc-loading-message">
        Đang tải danh sách nhân viên...
      </p>
      <div id="pc-employee-list-scroll" class="pc-employee-list-scroll"></div>
    `;

    const employeeListScrollDiv = document.getElementById(
      'pc-employee-list-scroll'
    );

    // gắn lại handler cho checkbox "chọn tất cả"
    const selectAllNew = document.getElementById('pc-select-all');
    if (selectAllNew) {
      selectAllNew.onchange = handleSelectAllChange;
    }

    modal.showModal();

    // 🔹 LẤY DANH SÁCH NHÂN VIÊN (BE đã tự lọc theo quyền manager/admin)
    const nvRes = await api('/phan-cong-lam-bu/nhan-vien-cho-phan-cong');
    const assignedRes = await api(`/phan-cong-lam-bu/${ngay}`);

    const nvList = nvRes.items || [];
    const assignedIds = (assignedRes.data || []).map((nv) => nv.nhan_vien_id);

    const loadingText = document.getElementById('pc-loading-text');
    if (loadingText) loadingText.remove();

    if (!nvList.length) {
      employeeListScrollDiv.insertAdjacentHTML(
        'beforeend',
        '<p class="pc-empty-message">Không có nhân viên nào trong hệ thống!</p>'
      );
      return;
    }

    const nvListHtml = nvList
      .map(
        (nv) => `
        <div class="pc-employee-item">
          <label class="pc-label-employee">
            <input type="checkbox"
                   value="${nv.id}"
                   class="pc-checkbox"
                   ${assignedIds.includes(nv.id) ? 'checked' : ''} />
            ${nv.ho_ten} (${nv.ten_phong_ban || 'Chưa có PB'})
          </label>
        </div>`
      )
      .join('');

    employeeListScrollDiv.insertAdjacentHTML('beforeend', nvListHtml);

    // Nếu tất cả đều được chọn → tick luôn "chọn tất cả"
    if (nvList.length > 0 && assignedIds.length === nvList.length) {
      if (selectAllNew) selectAllNew.checked = true;
    }
  } catch (err) {
    console.error('❌ Lỗi khi mở modal làm bù:', err);
    danhSachNhanVien.innerHTML = `<p class="pc-error-message">
      Không thể tải dữ liệu: ${err.message}
    </p>`;
  }
}

/**
 * 💾 Lưu danh sách nhân viên được phân công làm bù
 */
saveBtn.onclick = async () => {
  try {
    const ngay = ngayText.textContent;
    const container = document.getElementById('pc-employee-list-scroll');

    const nhan_vien_ids = Array.from(
      container.querySelectorAll('input.pc-checkbox:checked')
    ).map((el) => Number(el.value));

    const res = await api('/phan-cong-lam-bu', {
      method: 'POST',
      body: { ngay, nhan_vien_ids },
    });

    alert(res.message || 'Đã lưu phân công!');
    modal.close();
  } catch (err) {
    console.error('❌ Lỗi khi lưu phân công:', err);
    alert('Không thể lưu danh sách: ' + (err.message || 'Lỗi không xác định'));
  }
};

/**
 * ❌ Đóng modal khi bấm “Hủy”
 */
cancelBtn.onclick = () => modal.close();
