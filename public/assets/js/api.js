/* ==========================================================================
   api.js — ตัวกลางเรียก Google Apps Script Web App (ต้องตั้งค่า API_URL ใน config.js)
   ========================================================================== */

const Api = (() => {
  function isConfigured() {
    return /^https:\/\/script\.google\.com\/macros\/s\/[^\s]+\/exec$/.test(API_URL);
  }

  async function get(params) {
    if (!isConfigured()) return { ok: false, message: "ยังไม่ได้ตั้งค่า API_URL ใน config.js" };
    try {
      const url = new URL(API_URL);
      Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
      url.searchParams.set("t", Date.now()); // กัน cache
      const response = await fetch(url.toString(), { cache: "no-store" });
      return await response.json();
    } catch (error) {
      return { ok: false, message: "เชื่อมต่อ Google Sheets ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ต/URL" };
    }
  }

  async function post(payload) {
    if (!isConfigured()) return { ok: false, message: "ยังไม่ได้ตั้งค่า API_URL ใน config.js" };
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        // ใช้ text/plain เพื่อเลี่ยง CORS preflight กับ Apps Script Web App
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch (_) {
        return { ok: false, message: "เซิร์ฟเวอร์ส่งข้อมูลกลับมาไม่ถูกต้อง" };
      }
    } catch (error) {
      return { ok: false, message: "ส่งข้อมูลไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่" };
    }
  }

  return {
    isConfigured,

    /** รายชื่อ "รหัสที่นั่ง" ที่ถูกล็อกแล้วเท่านั้น (ไม่มีข้อมูลลูกค้า) — ใช้แสดงผลผังที่นั่งสาธารณะ */
    async getBookedSeats() {
      const result = await get({ action: "seats" });
      if (!result.ok) return result;
      return { ok: true, bookedSeatIds: Array.isArray(result.bookedSeatIds) ? result.bookedSeatIds : [] };
    },

    /** ส่งคำขอจองใหม่ */
    async createBooking(record) {
      return post({ action: "create", record });
    },

    /** เข้าสู่ระบบแอดมิน — คืน token เมื่อรหัสผ่านถูกต้อง */
    async adminLogin(password) {
      return post({ action: "adminLogin", password });
    },

    /** ดึงรายการจองทั้งหมด (ข้อมูลเต็ม) — ต้องมี token */
    async adminList(token) {
      return get({ action: "adminList", token });
    },

    /** อนุมัติ/ปฏิเสธรายการจอง — ต้องมี token */
    async adminUpdateStatus(token, bookingId, status, rejectReason) {
      return post({ action: "adminUpdateStatus", token, booking_id: bookingId, status, reject_reason: rejectReason || "" });
    }
  };
})();
