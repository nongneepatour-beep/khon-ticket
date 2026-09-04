/* ==========================================================================
   booking.js — ตรรกะหน้าจองตั๋ว (public): เลือกที่นั่ง, ฟอร์ม, ส่งคำขอจอง
   ========================================================================== */

(() => {
  const money = value => `${new Intl.NumberFormat("th-TH").format(Number(value || 0))} บาท`;
  const esc = value =>
    String(value || "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));

  const seatMapEl = document.getElementById("seat-map");
  const priceLegendEl = document.getElementById("price-legend");
  const liveSeatCountEl = document.getElementById("live-seat-count");
  const selectedCountEl = document.getElementById("selected-count");
  const grandTotalEl = document.getElementById("grand-total");
  const seatListEl = document.getElementById("seat-list");
  const emptySelectionEl = document.getElementById("empty-selection");
  const clearSelectionBtn = document.getElementById("clear-selection");
  const syncStatusEl = document.getElementById("sync-status");

  const form = document.getElementById("booking-form");
  const paymentSlipInput = document.getElementById("payment-slip");
  const paymentSlipPreview = document.getElementById("payment-slip-preview");
  const bookingMessageEl = document.getElementById("booking-message");
  const submitBtn = document.getElementById("confirm-booking");

  const bookingConfirmEl = document.getElementById("booking-confirm");
  const bookingTicketEl = document.getElementById("booking-ticket");
  const saveTicketBtn = document.getElementById("save-ticket-image");

  let selectedSeats = new Set();
  let bookedSeats = Storage.getBookedSeats(); // เริ่มจาก cache ในเครื่องก่อน (แสดงผลได้ทันที)
  let paymentSlip = null; // { name, type, data }

  function getSelectedSeatObjects() {
    return [...selectedSeats].map(id => SEAT_BY_ID.get(id)).filter(Boolean).sort((a, b) => a.id.localeCompare(b.id));
  }

  function toggleSeat(id) {
    if (bookedSeats.has(id)) return;
    selectedSeats.has(id) ? selectedSeats.delete(id) : selectedSeats.add(id);
    refreshSeatView();
    updateSummary();
  }

  function refreshSeatView() {
    SeatMap.updateStates(seatMapEl, { selectedSeats, bookedSeats });
  }

  function updateSummary() {
    const seats = getSelectedSeatObjects();
    const total = seats.reduce((sum, seat) => sum + seat.price, 0);

    selectedCountEl.textContent = seats.length;
    grandTotalEl.textContent = money(total);
    liveSeatCountEl.textContent = `จองแล้ว ${bookedSeats.size} ที่นั่ง · เลือกอยู่ ${seats.length} ที่นั่ง`;

    seatListEl.querySelectorAll(".seat-row-item").forEach(el => el.remove());
    emptySelectionEl.classList.toggle("hidden", seats.length > 0);
    seats.forEach(seat => {
      const row = document.createElement("div");
      row.className = "row seat-row-item";
      row.innerHTML = `<span>${esc(seat.zoneName)} · แถว ${seat.row} · เลขที่ ${seat.number}</span><strong>${money(seat.price)}</strong>`;
      seatListEl.appendChild(row);
    });

    document.getElementById("payment-amount").placeholder = total ? String(total) : "0";
  }

  function showFieldError(id, message) {
    const el = document.getElementById(`${id}-error`);
    if (el) el.textContent = message || "";
  }

  function clearFieldErrors() {
    ["first-name", "last-name", "phone", "email", "payment-method", "payment-amount", "payment-slip", "seats"].forEach(id =>
      showFieldError(id, "")
    );
  }

  function showBookingMessage(text, type) {
    bookingMessageEl.textContent = text;
    bookingMessageEl.className = `notice notice-${type}`;
    bookingMessageEl.classList.remove("hidden");
  }

  function hideBookingMessage() {
    bookingMessageEl.classList.add("hidden");
  }

  function validate() {
    clearFieldErrors();
    const values = {
      firstName: document.getElementById("first-name").value.trim(),
      lastName: document.getElementById("last-name").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      email: document.getElementById("email").value.trim(),
      paymentMethod: document.querySelector('input[name="payment-method"]:checked')?.value || "",
      paymentAmount: Number(document.getElementById("payment-amount").value)
    };
    const seats = getSelectedSeatObjects();
    const total = seats.reduce((sum, seat) => sum + seat.price, 0);
    const errors = {};

    if (!values.firstName) errors["first-name"] = "กรุณากรอกชื่อ";
    if (!values.lastName) errors["last-name"] = "กรุณากรอกนามสกุล";
    if (!/^0\d{8,9}$/.test(values.phone.replace(/[-\s]/g, ""))) errors["phone"] = "กรุณากรอกเบอร์โทรศัพท์ไทยให้ถูกต้อง";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors["email"] = "กรุณากรอกอีเมลให้ถูกต้อง";
    if (!values.paymentMethod) errors["payment-method"] = "กรุณาเลือกวิธีชำระเงิน";
    if (seats.length === 0) errors["seats"] = "กรุณาเลือกที่นั่งอย่างน้อย 1 ที่นั่ง";
    if (values.paymentAmount !== total) errors["payment-amount"] = `กรุณาระบุยอด ${total} บาทให้ตรงกับยอดรวม`;
    if (!paymentSlip) errors["payment-slip"] = "กรุณาแนบหลักฐานการชำระเงิน";

    Object.entries(errors).forEach(([field, message]) => showFieldError(field, message));
    return { valid: Object.keys(errors).length === 0, values, seats, total, errors };
  }

  function createBookingId() {
    const now = new Date();
    const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const rand = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0, 6).toUpperCase();
    return `KHON-${date}-${rand}`;
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("ไม่สามารถอ่านไฟล์สลิปได้"));
      reader.readAsDataURL(file);
    });
  }

  paymentSlipInput.addEventListener("change", async event => {
    const file = event.target.files[0];
    paymentSlip = null;
    showFieldError("payment-slip", "");
    paymentSlipPreview.replaceChildren();
    paymentSlipPreview.classList.add("hidden");
    if (!file) return;

    if (!SLIP_ALLOWED_TYPES.includes(file.type) || file.size > SLIP_MAX_BYTES) {
      showFieldError(
        "payment-slip",
        file.size > SLIP_MAX_BYTES ? "ไฟล์มีขนาดเกิน 750 KB กรุณาเลือกไฟล์ที่เล็กลง" : "รองรับเฉพาะไฟล์ PNG, JPG หรือ PDF"
      );
      event.target.value = "";
      return;
    }

    try {
      paymentSlip = { name: file.name, type: file.type, data: await readFileAsDataUrl(file) };
      const label = document.createElement("p");
      label.className = "mb-2 fw-bold";
      label.textContent = `ไฟล์สลิป: ${file.name}`;
      paymentSlipPreview.appendChild(label);
      if (file.type.startsWith("image/")) {
        const img = document.createElement("img");
        img.src = paymentSlip.data;
        img.alt = "ตัวอย่างสลิปการชำระเงิน";
        img.className = "img-fluid rounded";
        img.style.maxHeight = "220px";
        paymentSlipPreview.appendChild(img);
      }
      paymentSlipPreview.classList.remove("hidden");
    } catch (_) {
      showFieldError("payment-slip", "ไม่สามารถอ่านไฟล์สลิปได้ กรุณาเลือกไฟล์ใหม่");
    }
  });

  const promptpayPanel = document.getElementById("promptpay-panel");
  const bankPanel = document.getElementById("bank-panel");
  document.querySelectorAll('input[name="payment-method"]').forEach(input =>
    input.addEventListener("change", event => {
      showFieldError("payment-method", "");
      promptpayPanel.classList.toggle("hidden", event.target.value !== "พร้อมเพย์");
      bankPanel.classList.toggle("hidden", event.target.value !== "โอนผ่านธนาคาร");
    })
  );

  clearSelectionBtn.addEventListener("click", () => {
    selectedSeats.clear();
    refreshSeatView();
    updateSummary();
  });

  // บันทึกหลักฐานการจองเป็นรูปภาพ (PNG) เพื่อให้ผู้จองเก็บไว้แสดงกับเจ้าหน้าที่ตอนเช็คหน้างาน
  saveTicketBtn.addEventListener("click", async () => {
    if (typeof html2canvas !== "function") {
      showBookingMessage("ไม่สามารถโหลดตัวช่วยบันทึกรูปภาพได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่", "error");
      return;
    }
    saveTicketBtn.disabled = true;
    saveTicketBtn.classList.add("disabled");
    try {
      const canvas = await html2canvas(bookingTicketEl, { backgroundColor: "#17140b", scale: 2 });
      const bookingId = document.getElementById("confirm-booking-id").textContent.trim() || "booking";
      const link = document.createElement("a");
      link.download = `${bookingId}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (_) {
      showBookingMessage("บันทึกรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", "error");
    } finally {
      saveTicketBtn.disabled = false;
      saveTicketBtn.classList.remove("disabled");
    }
  });

  document.getElementById("scroll-to-seats")?.addEventListener("click", () =>
    document.getElementById("seat-section").scrollIntoView({ behavior: "smooth" })
  );

  async function handleSubmit(event) {
    event.preventDefault();
    hideBookingMessage();

    // ตรวจจากข้อมูลล่าสุดในเครื่องก่อน (เผื่อ poll เพิ่งอัปเดตหลังผู้ใช้เลือกที่นั่งไว้)
    const stale = getSelectedSeatObjects().filter(seat => bookedSeats.has(seat.id));
    if (stale.length) {
      stale.forEach(seat => selectedSeats.delete(seat.id));
      refreshSeatView();
      updateSummary();
      showBookingMessage(
        `ที่นั่ง ${stale.map(s => `${s.row}${s.number}`).join(", ")} เพิ่งถูกจองไปแล้ว กรุณาเลือกที่นั่งใหม่`,
        "error"
      );
      return;
    }

    const check = validate();
    if (!check.valid) {
      showBookingMessage("กรุณาตรวจสอบข้อมูลในแบบฟอร์มให้ครบถ้วน", "error");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.classList.add("disabled");

    const seatIds = check.seats.map(seat => seat.id);
    const bookingId = createBookingId();
    const record = {
      booking_id: bookingId,
      created_at: new Date().toISOString(),
      seats: seatIds.join("|"),
      seat_zones: [...new Set(check.seats.map(seat => seat.zoneName))].join(", "),
      seat_count: check.seats.length,
      total_price: check.total,
      first_name: check.values.firstName,
      last_name: check.values.lastName,
      phone: check.values.phone,
      email: check.values.email,
      payment_method: check.values.paymentMethod,
      payment_amount_declared: check.values.paymentAmount,
      slip_filename: paymentSlip.name,
      slip_mime: paymentSlip.type,
      slip_data: paymentSlip.data,
      booking_status: "รอตรวจสอบการชำระเงิน"
    };

    // บันทึกแบบ optimistic ในเครื่องก่อน ผู้ใช้เห็นผลทันทีแม้เน็ตช้า
    Storage.addBookedSeats(seatIds);
    Storage.addBooking(record);
    seatIds.forEach(id => bookedSeats.add(id));
    selectedSeats.clear();
    refreshSeatView();
    updateSummary();
    showConfirmation(record, Api.isConfigured() ? "pending-sync" : "local-only");

    let result = { ok: true };
    if (Api.isConfigured()) {
      result = await Api.createBooking(record);
    }

    submitBtn.disabled = false;
    submitBtn.classList.remove("disabled");

    if (!result.ok && result.conflict) {
      // ที่นั่งชนกับรายการอื่นจริงบนเซิร์ฟเวอร์ — ต้อง rollback การจองนี้ทั้งหมด
      Storage.removeBookedSeats(seatIds);
      seatIds.forEach(id => bookedSeats.delete(id));
      if (Array.isArray(result.bookedSeatIds)) {
        bookedSeats = new Set(result.bookedSeatIds);
        Storage.setBookedSeats(bookedSeats);
      }
      refreshSeatView();
      updateSummary();
      bookingConfirmEl.classList.add("hidden");
      showBookingMessage(result.message || "ที่นั่งบางส่วนถูกจองไปแล้ว กรุณาเลือกที่นั่งใหม่แล้วลองอีกครั้ง", "error");
      return;
    }

    if (!result.ok) {
      // ปัญหาการเชื่อมต่ออื่นๆ (ไม่ใช่ที่นั่งชนกัน) — เก็บรายการไว้ในเครื่องนี้ แจ้งเตือนว่ายังไม่ sync
      updateSyncStatus(`บันทึกการจอง ${bookingId} ไว้ในเครื่องนี้แล้ว แต่ยังไม่ได้ส่งเข้า Google Sheets: ${result.message || ""}`, "error");
      return;
    }

    form.reset();
    paymentSlip = null;
    paymentSlipPreview.replaceChildren();
    paymentSlipPreview.classList.add("hidden");
    document.querySelectorAll('input[name="payment-method"]').forEach(r => (r.checked = false));
    promptpayPanel.classList.add("hidden");
    bankPanel.classList.add("hidden");
    syncFromServer();
  }

  function showConfirmation(record, syncState) {
    document.getElementById("confirm-show-info").textContent = `${SHOW_INFO.title} · ${SHOW_INFO.venue} · ${SHOW_INFO.datetime}`;
    document.getElementById("confirm-booking-id").textContent = record.booking_id;
    document.getElementById("confirm-name").textContent = `${record.first_name} ${record.last_name}`;
    document.getElementById("confirm-phone").textContent = record.phone;
    document.getElementById("confirm-seats").textContent = record.seats.split("|").map(id => {
      const seat = SEAT_BY_ID.get(id);
      return seat ? `${seat.row}${seat.number}` : id;
    }).join(", ");
    document.getElementById("confirm-zones").textContent = record.seat_zones;
    document.getElementById("confirm-total").textContent = money(record.total_price);
    document.getElementById("confirm-status").textContent =
      syncState === "local-only"
        ? "บันทึกในเครื่องนี้เท่านั้น (ยังไม่ได้เชื่อมต่อ Google Sheets)"
        : "รอตรวจสอบการชำระเงิน — กำลังส่งเข้าระบบ...";
    bookingConfirmEl.classList.remove("hidden");
    bookingConfirmEl.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function updateSyncStatus(text, type) {
    syncStatusEl.textContent = text;
    syncStatusEl.className = `notice notice-${type}`;
  }

  async function syncFromServer() {
    if (!Api.isConfigured()) {
      updateSyncStatus("ยังไม่ได้ตั้งค่า API_URL ใน config.js — ระบบทำงานแบบบันทึกในเครื่องนี้เท่านั้น", "info");
      return;
    }
    const result = await Api.getBookedSeats();
    if (!result.ok) {
      updateSyncStatus(result.message || "ไม่สามารถเชื่อมต่อ Google Sheets ได้ในขณะนี้", "error");
      return;
    }
    bookedSeats = new Set(result.bookedSeatIds);
    Storage.setBookedSeats(bookedSeats);

    // ถ้าที่นั่งที่ผู้ใช้กำลังเลือกอยู่ถูกคนอื่นจองไปพอดี ต้องเอาออกจากรายการที่เลือก
    let removed = false;
    selectedSeats.forEach(id => {
      if (bookedSeats.has(id)) {
        selectedSeats.delete(id);
        removed = true;
      }
    });
    refreshSeatView();
    updateSummary();
    if (removed) showBookingMessage("มีบางที่นั่งที่คุณเลือกไว้ถูกจองไปแล้ว ระบบได้นำออกจากรายการให้อัตโนมัติ", "error");
    updateSyncStatus("เชื่อมต่อ Google Sheets แล้ว · ข้อมูลที่นั่งอัปเดตล่าสุด", "success");
  }

  // ผังที่นั่งกว้างกว่าจอ (โดยเฉพาะมือถือ) — เลื่อนให้เห็นกึ่งกลางผัง (โซน B1 กลาง) เป็นค่าเริ่มต้นเสมอ
  // แทนที่จะเริ่มที่ขอบซ้ายสุด (โซน C1 ฝั่งซ้าย) ผู้ใช้ค่อยเลื่อนซ้าย-ขวาเองจากตรงนี้
  function centerSeatMapScroll() {
    const scrollEl = document.querySelector(".seat-map-scroll");
    if (!scrollEl) return;
    scrollEl.scrollLeft = (scrollEl.scrollWidth - scrollEl.clientWidth) / 2;
  }

  let pollTimer = null;
  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      if (document.visibilityState === "visible") syncFromServer();
    }, 15000);
  }

  form.addEventListener("submit", handleSubmit);

  document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("show-title").textContent = SHOW_INFO.title;
    document.getElementById("show-datetime").textContent = `${SHOW_INFO.venue} · ${SHOW_INFO.datetime}`;

    SeatMap.render(seatMapEl, { onToggle: toggleSeat });
    SeatMap.renderPriceLegend(priceLegendEl);
    refreshSeatView();
    updateSummary();
    centerSeatMapScroll();
    await syncFromServer();
    startPolling();
  });
})();
