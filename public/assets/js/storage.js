/* ==========================================================================
   storage.js — เก็บสถานะที่นั่ง/ประวัติการจองไว้ในเบราว์เซอร์ (localStorage)
   ทำหน้าที่เป็น cache ฝั่งไคลเอนต์ที่ sync กับ Google Sheets (ตัวจริง) อยู่เสมอ
   ========================================================================== */

const Storage = (() => {
  const KEY_BOOKED_SEATS = "khon_booked_seats_v1";
  const KEY_BOOKINGS = "khon_bookings_v1";

  function safeGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function safeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {
      /* localStorage อาจใช้ไม่ได้ (private mode / เต็ม) — ปล่อยผ่าน ไม่ทำให้แอปพัง */
    }
  }

  return {
    /** คืน Set ของรหัสที่นั่งที่ถูกจองแล้ว (จาก cache ล่าสุดในเครื่องนี้) */
    getBookedSeats() {
      return new Set(safeGet(KEY_BOOKED_SEATS, []));
    },
    /** บันทึกรายการที่นั่งที่จองแล้วทั้งหมดทับ cache เดิม (ใช้ตอน sync จาก Sheets) */
    setBookedSeats(seatIds) {
      safeSet(KEY_BOOKED_SEATS, Array.from(new Set(seatIds)));
    },
    /** เพิ่มที่นั่งเข้า cache แบบ optimistic ก่อนได้รับคำตอบจากเซิร์ฟเวอร์ */
    addBookedSeats(seatIds) {
      const current = this.getBookedSeats();
      seatIds.forEach(id => current.add(id));
      this.setBookedSeats(current);
    },
    /** ถอนที่นั่งออกจาก cache (ใช้ตอน rollback เมื่อจองไม่สำเร็จ) */
    removeBookedSeats(seatIds) {
      const current = this.getBookedSeats();
      seatIds.forEach(id => current.delete(id));
      this.setBookedSeats(current);
    },

    /** ประวัติการจองของผู้ใช้เครื่องนี้ (เรียงล่าสุดก่อน) */
    getBookings() {
      return safeGet(KEY_BOOKINGS, []);
    },
    addBooking(record) {
      const list = this.getBookings();
      list.unshift(record);
      safeSet(KEY_BOOKINGS, list.slice(0, 50));
    }
  };
})();
