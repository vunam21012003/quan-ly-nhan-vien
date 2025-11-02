import { api } from './api.js';

const modal = document.getElementById('phanCongModal');
const danhSachNhanVien = document.getElementById('pc-list');
const ngayText = document.getElementById('pc-ngay');
const saveBtn = document.getElementById('btn-pc-save');
const cancelBtn = document.getElementById('btn-pc-cancel');

/**
 * 🧭 Hiển thị popup phân công làm bù
 * @param {string} ngay - Ngày làm bù (YYYY-MM-DD)
 */
export async function openPhanCongModal(ngay) {
  try {
    ngayText.textContent = ngay;
    modal.showModal();
    danhSachNhanVien.innerHTML = '<p>Đang tải danh sách nhân viên...</p>';

    // 🔹 Lấy danh sách nhân viên toàn công ty
    const nvRes = await api('/nhan-vien?limit=500');
    const assignedRes = await api(`/phan-cong-lam-bu/${ngay}`);

    const nvList = nvRes.items || [];
    const assignedIds = (assignedRes.data || []).map((nv) => nv.nhan_vien_id);

    if (!nvList.length) {
      danhSachNhanVien.innerHTML =
        '<p>Không có nhân viên nào trong hệ thống!</p>';
      return;
    }

    // 🔹 Hiển thị danh sách nhân viên có tick chọn
    danhSachNhanVien.innerHTML = nvList
      .map(
        (nv) => `
        <label style="display:block;margin:5px 0;">
          <input type="checkbox" value="${nv.id}" ${
          assignedIds.includes(nv.id) ? 'checked' : ''
        } />
          ${nv.ho_ten} (${nv.ten_phong_ban || 'Chưa có PB'})
        </label>`
      )
      .join('');
  } catch (err) {
    console.error('❌ Lỗi khi mở modal làm bù:', err);
    danhSachNhanVien.innerHTML = `<p style="color:red;">Không thể tải dữ liệu: ${err.message}</p>`;
  }
}

/**
 * 💾 Lưu danh sách nhân viên được phân công làm bù
 */
saveBtn.onclick = async () => {
  try {
    const ngay = ngayText.textContent;
    const nhan_vien_ids = Array.from(
      danhSachNhanVien.querySelectorAll('input:checked')
    ).map((el) => Number(el.value));

    const res = await api('/phan-cong-lam-bu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ngay, nhan_vien_ids }),
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
