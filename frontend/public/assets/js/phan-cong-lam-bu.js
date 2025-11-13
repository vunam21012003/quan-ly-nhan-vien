import { api } from './api.js';

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

    // Reset nút "Chọn tất cả"
    selectAllCheckbox.checked = false;

    // 💡 Cập nhật HTML: Thêm class CSS và container cuộn (pc-employee-list-scroll)
    danhSachNhanVien.innerHTML = `
            <div class="pc-select-all-header">
                <label class="pc-label-select-all">
                    ${selectAllCheckbox.outerHTML}
                    <strong>Chọn tất cả nhân viên</strong>
                </label>
            </div>
            <p id="pc-loading-text" class="pc-loading-message">Đang tải danh sách nhân viên...</p>
            <div id="pc-employee-list-scroll" class="pc-employee-list-scroll"></div>
        `;

    // Lấy tham chiếu đến container cuộn mới
    const employeeListScrollDiv = document.getElementById(
      'pc-employee-list-scroll'
    );

    // Gắn lại sự kiện cho nút "Chọn tất cả" vừa được chèn
    const selectAllNew = document.getElementById('pc-select-all');
    if (selectAllNew) {
      selectAllNew.onchange = handleSelectAllChange;
    }

    modal.showModal(); // Mở modal

    // 🔹 LẤY DANH SÁCH NHÂN VIÊN
    const nvRes = await api('/phan-cong-lam-bu/nhan-vien-cho-phan-cong');
    const assignedRes = await api(`/phan-cong-lam-bu/${ngay}`);

    const nvList = nvRes.items || [];
    const assignedIds = (assignedRes.data || []).map((nv) => nv.nhan_vien_id);

    const loadingText = document.getElementById('pc-loading-text');
    if (loadingText) loadingText.remove(); // Xóa thông báo loading

    if (!nvList.length) {
      // Chèn vào div cuộn
      employeeListScrollDiv.insertAdjacentHTML(
        'beforeend',
        '<p class="pc-empty-message">Không có nhân viên nào trong hệ thống!</p>'
      );
      return;
    }

    // 🔹 Hiển thị danh sách nhân viên có tick chọn (dùng class mới)
    const nvListHtml = nvList
      .map(
        (nv) => `
                <div class="pc-employee-item">
                    <label class="pc-label-employee">
                        <input type="checkbox" value="${
                          nv.id
                        }" class="pc-checkbox" ${
          assignedIds.includes(nv.id) ? 'checked' : ''
        } />
                        ${nv.ho_ten} (${nv.ten_phong_ban || 'Chưa có PB'})
                    </label>
                </div>`
      )
      .join('');

    // Chèn danh sách nhân viên vào container cuộn
    employeeListScrollDiv.insertAdjacentHTML('beforeend', nvListHtml);

    // Kiểm tra nếu tất cả nhân viên đã được chọn, tự động tích vào "Chọn tất cả"
    if (nvList.length > 0 && assignedIds.length === nvList.length) {
      if (selectAllNew) selectAllNew.checked = true;
    }
  } catch (err) {
    console.error('❌ Lỗi khi mở modal làm bù:', err);
    danhSachNhanVien.innerHTML = `<p class="pc-error-message">Không thể tải dữ liệu: ${err.message}</p>`;
  }
}

/**
 * 💾 Lưu danh sách nhân viên được phân công làm bù
 */
saveBtn.onclick = async () => {
  try {
    const ngay = ngayText.textContent;
    const nhan_vien_ids = Array.from(
      // 💡 Lọc ra tất cả checkbox đã được chọn, loại trừ checkbox "Chọn tất cả"
      danhSachNhanVien.querySelectorAll('input[type="checkbox"]:checked')
    )
      .filter((el) => el.id !== 'pc-select-all')
      .map((el) => Number(el.value));

    const res = await api('/phan-cong-lam-bu', {
      method: 'POST',
      body: { ngay, nhan_vien_ids },
    });

    alert(res.message || '✅ Đã lưu danh sách phân công làm bù!');
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
