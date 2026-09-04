/* ==========================================================================
   admin.js — ล็อกอินแอดมิน + แดชบอร์ดตรวจสอบ/อนุมัติ-ปฏิเสธการจอง
   ========================================================================== */

(() => {
  const TOKEN_KEY = "khon_admin_token";
  const money = value => `${new Intl.NumberFormat("th-TH").format(Number(value || 0))} บาท`;
  const esc = value =>
    String(value || "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));
  const formatDate = iso => (iso ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "-");

  const loginSection = document.getElementById("admin-login-section");
  const dashboardSection = document.getElementById("admin-dashboard-section");
  const loginForm = document.getElementById("admin-login-form");
  const loginError = document.getElementById("admin-login-error");
  const loginBtn = document.getElementById("admin-login-btn");
  const logoutBtn = document.getElementById("logout-btn");

  const statusFilter = document.getElementById("status-filter");
  const refreshBtn = document.getElementById("refresh-btn");
  const adminMessage = document.getElementById("admin-message");
  const pendingCountEl = document.getElementById("pending-count");
  const bookingListEl = document.getElementById("booking-list");
  const adminEmptyEl = document.getElementById("admin-empty");

  const detailModalEl = document.getElementById("booking-detail-modal");
  const detailContent = document.getElementById("detail-content");
  const detailSlip = document.getElementById("detail-slip-container");
  const rejectReasonEl = document.getElementById("reject-reason");
  const approveBtn = document.getElementById("approve-btn");
  const rejectBtn = document.getElementById("reject-btn");
  const adminActionMessage = document.getElementById("admin-action-message");
  const detailModal = window.bootstrap ? new bootstrap.Modal(detailModalEl) : null;

  let token = sessionStorage.getItem(TOKEN_KEY) || "";
  let records = [];
  let selectedRecordId = null;
  let pollTimer = null;

  function statusClass(status) {
    if (status === "อนุมัติแล้ว") return "status-approved";
    if (status === "ปฏิเสธแล้ว") return "status-rejected";
    return "status-pending";
  }

  function showLogin() {
    loginSection.classList.remove("hidden");
    dashboardSection.classList.add("hidden");
    if (pollTimer) clearInterval(pollTimer);
  }

  function showDashboard() {
    loginSection.classList.add("hidden");
    dashboardSection.classList.remove("hidden");
    refreshList();
    startPolling();
  }

  async function handleLogin(event) {
    event.preventDefault();
    loginError.textContent = "";
    const password = document.getElementById("admin-password").value;
    if (!password) return;

    if (!Api.isConfigured()) {
      loginError.textContent = "ยังไม่ได้ตั้งค่า API_URL ใน config.js";
      return;
    }

    loginBtn.disabled = true;
    loginBtn.classList.add("disabled");
    const result = await Api.adminLogin(password);
    loginBtn.disabled = false;
    loginBtn.classList.remove("disabled");

    if (!result.ok) {
      loginError.textContent = result.message || "รหัสผ่านไม่ถูกต้อง";
      return;
    }
    token = result.token;
    sessionStorage.setItem(TOKEN_KEY, token);
    loginForm.reset();
    showDashboard();
  }

  function handleLogout() {
    token = "";
    sessionStorage.removeItem(TOKEN_KEY);
    showLogin();
  }

  async function refreshList() {
    const result = await Api.adminList(token);
    if (!result.ok) {
      if (result.message && /token|เข้าสู่ระบบ|unauthorized/i.test(result.message)) {
        handleLogout();
        return;
      }
      adminMessage.textContent = result.message || "โหลดข้อมูลไม่สำเร็จ";
      adminMessage.className = "notice notice-error";
      return;
    }
    records = Array.isArray(result.records) ? result.records : [];
    adminMessage.textContent = `เชื่อมต่อ Google Sheets แล้ว · พบทั้งหมด ${records.length} รายการ`;
    adminMessage.className = "notice notice-success";
    renderList();
  }

  function renderList() {
    const filter = statusFilter.value;
    const sorted = [...records].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const visible = filter === "all" ? sorted : sorted.filter(r => r.booking_status === filter);
    const pendingCount = sorted.filter(r => r.booking_status === "รอตรวจสอบการชำระเงิน").length;
    pendingCountEl.textContent = `${pendingCount} รายการ`;

    bookingListEl.replaceChildren();
    adminEmptyEl.classList.toggle("hidden", visible.length > 0);

    visible.forEach(record => {
      const card = document.createElement("div");
      card.className = "booking-card";
      card.innerHTML = `
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-2">
          <div>
            <p class="fw-bold text-gold mb-0">${esc(record.booking_id)}</p>
            <p class="small text-muted mb-0">แจ้งรายการ: ${esc(formatDate(record.created_at))}</p>
          </div>
          <span class="status-pill ${statusClass(record.booking_status)}">${esc(record.booking_status || "รอตรวจสอบการชำระเงิน")}</span>
        </div>
        <dl class="booking-grid mt-3">
          <div><dt>ผู้จอง</dt><dd>${esc(record.first_name)} ${esc(record.last_name)}</dd></div>
          <div><dt>ที่นั่ง/โซน</dt><dd>${esc(record.seat_zones)} (${esc(record.seat_count)} ที่นั่ง)</dd></div>
          <div><dt>ยอดรวม</dt><dd>${money(record.total_price)}</dd></div>
          <div><dt>วิธีชำระเงิน</dt><dd>${esc(record.payment_method)}</dd></div>
        </dl>
        <div class="mt-3 text-end">
          <button type="button" class="btn btn-outline btn-sm view-detail">ดูรายละเอียด</button>
        </div>`;
      card.querySelector(".view-detail").addEventListener("click", () => openDetail(record.booking_id));
      bookingListEl.appendChild(card);
    });
  }

  function openDetail(bookingId) {
    const record = records.find(r => r.booking_id === bookingId);
    if (!record) return;
    selectedRecordId = bookingId;

    detailContent.innerHTML = `
      <div class="row g-3">
        <div class="col-sm-6"><div class="stat-box"><div class="label">เลขที่การจอง</div><div class="value fs-6">${esc(record.booking_id)}</div></div></div>
        <div class="col-sm-6"><div class="stat-box"><div class="label">สถานะ</div><div class="value fs-6">${esc(record.booking_status)}</div></div></div>
        <div class="col-sm-6"><div class="stat-box"><div class="label">ผู้จอง</div><div class="value fs-6">${esc(record.first_name)} ${esc(record.last_name)}</div></div></div>
        <div class="col-sm-6"><div class="stat-box"><div class="label">เบอร์โทร / อีเมล</div><div class="value fs-6">${esc(record.phone)}<br>${esc(record.email)}</div></div></div>
        <div class="col-sm-6"><div class="stat-box"><div class="label">ที่นั่ง</div><div class="value fs-6">${esc(record.seats)}</div></div></div>
        <div class="col-sm-6"><div class="stat-box"><div class="label">ยอดที่ต้องชำระ / ที่แจ้ง</div><div class="value fs-6">${money(record.total_price)} / ${money(record.payment_amount_declared)}</div></div></div>
      </div>`;

    detailSlip.replaceChildren();
    if (record.slip_url) {
      const img = document.createElement("img");
      img.src = record.slip_url;
      img.alt = `สลิปการชำระเงิน ${record.booking_id}`;
      img.className = "slip-image";
      detailSlip.appendChild(img);
      const link = document.createElement("a");
      link.href = record.slip_url;
      link.target = "_blank";
      link.rel = "noopener";
      link.className = "btn btn-outline btn-sm mt-2";
      link.textContent = "เปิดไฟล์จาก Google Drive";
      detailSlip.appendChild(link);
    } else {
      detailSlip.innerHTML = '<p class="text-danger fw-bold">ยังไม่มีหลักฐานการชำระเงิน</p>';
    }

    const canAct = record.booking_status === "รอตรวจสอบการชำระเงิน";
    approveBtn.classList.toggle("hidden", !canAct);
    rejectBtn.classList.toggle("hidden", !canAct);
    rejectReasonEl.value = "";
    adminActionMessage.textContent = "";
    detailModal?.show();
  }

  async function updateStatus(nextStatus) {
    const record = records.find(r => r.booking_id === selectedRecordId);
    if (!record) return;
    const rejectReason = rejectReasonEl.value.trim();
    if (nextStatus === "ปฏิเสธแล้ว" && !rejectReason) {
      adminActionMessage.textContent = "กรุณาระบุเหตุผลก่อนปฏิเสธรายการ";
      return;
    }

    approveBtn.disabled = true;
    rejectBtn.disabled = true;
    const result = await Api.adminUpdateStatus(token, record.booking_id, nextStatus, rejectReason);
    approveBtn.disabled = false;
    rejectBtn.disabled = false;

    if (!result.ok) {
      adminActionMessage.textContent = result.message || "อัปเดตสถานะไม่สำเร็จ กรุณาลองใหม่";
      return;
    }
    detailModal?.hide();
    await refreshList();
    adminMessage.textContent = `อัปเดตสถานะรายการ ${record.booking_id} เป็น "${nextStatus}" แล้ว`;
    adminMessage.className = "notice notice-success";
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      if (document.visibilityState === "visible") refreshList();
    }, 20000);
  }

  loginForm.addEventListener("submit", handleLogin);
  logoutBtn.addEventListener("click", handleLogout);
  statusFilter.addEventListener("change", renderList);
  refreshBtn.addEventListener("click", refreshList);
  approveBtn.addEventListener("click", () => updateStatus("อนุมัติแล้ว"));
  rejectBtn.addEventListener("click", () => updateStatus("ปฏิเสธแล้ว"));

  document.addEventListener("DOMContentLoaded", () => {
    if (token) showDashboard();
    else showLogin();
  });
})();
