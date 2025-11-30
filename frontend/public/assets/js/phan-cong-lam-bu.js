import { api, getUser } from './api.js';

const modal = document.getElementById('phanCongModal');
const containerList = document.getElementById('pc-list');
const ngayText = document.getElementById('pc-ngay');
const saveBtn = document.getElementById('btn-pc-save');
const cancelBtn = document.getElementById('btn-pc-cancel');

// Biến lưu trạng thái cục bộ để xử lý tìm kiếm mà không mất dữ liệu check
let localEmployees = []; // Danh sách tất cả nhân viên lấy từ API
let localAssignedIds = []; // Danh sách ID đã được chọn (bao gồm cả những người đang bị ẩn do search)

/**
 * 🧭 Hiển thị popup phân công làm bù
 * @param {string} ngay - Ngày làm bù (YYYY-MM-DD)
 * @param {object} options - Tùy chọn lọc (ví dụ restrictPhongBan)
 */
export async function openPhanCongModal(ngay, options = {}) {
  try {
    ngayText.textContent = ngay;

    // 1. Reset giao diện loading & render cấu trúc HTML mới
    containerList.innerHTML = `
      <input type="text" id="pc-search-input" 
             placeholder="🔍 Tìm nhân viên hoặc phòng ban..." 
             style="width:100%; padding:10px; margin-bottom:10px; border:1px solid #ddd; border-radius:6px;">
             
      <div id="pc-list-wrapper" style="border:1px solid #eee; border-radius:8px; overflow:hidden; display:flex; flex-direction:column; max-height:350px;">
         <!-- Header: Chọn tất cả -->
         <div class="pc-select-all" style="padding:10px 12px; background:#f9fafb; border-bottom:1px solid #eee; font-weight:600; display:flex; align-items:center;">
            <input type="checkbox" id="pc-select-all" class="pc-checkbox" style="width:18px; height:18px; margin-right:10px; cursor:pointer;">
            <label for="pc-select-all" style="cursor:pointer; flex:1; margin:0; user-select:none;">Chọn tất cả</label>
         </div>

         <!-- Body: Danh sách cuộn -->
         <div id="pc-items-container" style="overflow-y:auto; flex:1; background:#fff; min-height: 100px;">
            <div style="padding:20px; text-align:center; color:#888;">
              <div class="spinner" style="margin:0 auto 10px;"></div> <!-- Nếu có class spinner -->
              ⏳ Đang tải dữ liệu...
            </div>
         </div>
      </div>
    `;

    modal.showModal();

    // 2. GỌI API (LOGIC CŨ CỦA BẠN)
    // Gọi song song để nhanh hơn
    const [nvRes, assignedRes] = await Promise.all([
      api('/phan-cong-lam-bu/nhan-vien-cho-phan-cong'),
      api(`/phan-cong-lam-bu/${ngay}`),
    ]);

    let allNV = nvRes.items || [];

    // Nếu có logic lọc theo phòng ban từ bên ngoài truyền vào (logic cũ của bạn có thể đã xử lý ở BE, nhưng FE lọc thêm cho chắc)
    if (options.restrictPhongBan) {
      allNV = allNV.filter((x) => x.phong_ban_id == options.restrictPhongBan);
    }

    // Lưu vào biến cục bộ
    localEmployees = allNV;
    localAssignedIds = (assignedRes.data || []).map((nv) => nv.nhan_vien_id);

    // 3. Render danh sách lần đầu
    renderEmployeeList(localEmployees);

    // 4. Gắn sự kiện Tìm kiếm
    const searchInput = document.getElementById('pc-search-input');
    searchInput.focus();
    searchInput.addEventListener('input', (e) => {
      const keyword = e.target.value.toLowerCase();
      const filtered = localEmployees.filter(
        (nv) =>
          nv.ho_ten.toLowerCase().includes(keyword) ||
          (nv.ten_phong_ban || '').toLowerCase().includes(keyword)
      );
      renderEmployeeList(filtered);
    });

    // 5. Gắn sự kiện "Chọn tất cả"
    const selectAllCb = document.getElementById('pc-select-all');
    selectAllCb.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      // Lấy các checkbox ĐANG HIỂN THỊ (để tôn trọng bộ lọc search)
      const visibleCheckboxes = document.querySelectorAll(
        '#pc-items-container input.pc-item-cb'
      );

      visibleCheckboxes.forEach((cb) => {
        cb.checked = isChecked;
        updateLocalState(parseInt(cb.value), isChecked);
      });
    });
  } catch (err) {
    console.error('❌ Lỗi khi mở modal:', err);
    const container = document.getElementById('pc-items-container');
    if (container) {
      container.innerHTML = `<p style="color:red; padding:15px; text-align:center;">❌ Lỗi tải dữ liệu: ${err.message}</p>`;
    }
  }
}

/**
 * Hàm render danh sách ra HTML
 */
function renderEmployeeList(listNV) {
  const container = document.getElementById('pc-items-container');
  const selectAllCb = document.getElementById('pc-select-all');

  if (!listNV.length) {
    container.innerHTML =
      '<p style="padding:20px; text-align:center; color:#999;">Không tìm thấy nhân viên phù hợp.</p>';
    return;
  }

  const html = listNV
    .map((nv) => {
      // Kiểm tra xem ID này có trong danh sách đã chọn không
      const isChecked = localAssignedIds.includes(nv.id);

      return `
        <label class="pc-item">
            <input type="checkbox" 
                   value="${nv.id}" 
                   class="pc-checkbox pc-item-cb" 
                   ${isChecked ? 'checked' : ''}>
            
            <div class="pc-info">
                <span class="pc-name">${nv.ho_ten}</span>
                <span class="pc-dept">${
                  nv.ten_phong_ban || 'Chưa có Phòng ban'
                }</span>
            </div>
        </label>
        `;
    })
    .join('');

  container.innerHTML = html;

  // Cập nhật trạng thái checkbox "Chọn tất cả"
  // Nếu danh sách hiển thị > 0 và TẤT CẢ đều đã được check -> check all
  const allChecked =
    listNV.length > 0 && listNV.every((nv) => localAssignedIds.includes(nv.id));
  selectAllCb.checked = allChecked;

  // Gắn sự kiện change cho từng checkbox con
  const checkboxes = container.querySelectorAll('.pc-item-cb');
  checkboxes.forEach((cb) => {
    cb.addEventListener('change', (e) => {
      const id = parseInt(e.target.value);
      updateLocalState(id, e.target.checked);

      // Check lại nút Select All
      const allNowChecked = Array.from(checkboxes).every((c) => c.checked);
      selectAllCb.checked = allNowChecked;
    });
  });
}

/**
 * Cập nhật trạng thái vào biến localAssignedIds
 */
function updateLocalState(id, isChecked) {
  if (isChecked) {
    if (!localAssignedIds.includes(id)) {
      localAssignedIds.push(id);
    }
  } else {
    localAssignedIds = localAssignedIds.filter((x) => x !== id);
  }
}

/**
 * 💾 Lưu danh sách (LOGIC API CŨ)
 */
saveBtn.onclick = async () => {
  try {
    const ngay = ngayText.textContent;

    // Lấy ID từ biến localAssignedIds (đảm bảo lấy cả những người bị ẩn do search)
    const nhan_vien_ids = localAssignedIds;

    if (nhan_vien_ids.length === 0) {
      if (
        !confirm(
          'Bạn chưa chọn nhân viên nào. Bạn có chắc chắn muốn lưu danh sách rỗng (xóa hết phân công)?'
        )
      )
        return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Đang lưu...';

    const res = await api('/phan-cong-lam-bu', {
      method: 'POST',
      body: { ngay, nhan_vien_ids },
    });

    alert(res.message || '✅ Đã lưu phân công thành công!');
    modal.close();
  } catch (err) {
    console.error('❌ Lỗi khi lưu phân công:', err);
    alert('Không thể lưu danh sách: ' + (err.message || 'Lỗi không xác định'));
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Lưu Phân công';
  }
};

/**
 * ❌ Đóng modal khi bấm “Hủy”
 */
cancelBtn.onclick = () => modal.close();
