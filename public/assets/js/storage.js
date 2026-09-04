/* ==========================================================================
   storage.js — เก็บสถานะที่นั่ง/ประวัติการจองไว้ในเบราว์เซอร์ (localStorage)
   ทำหน้าที่เป็น cache ฝั่งไคลเอนต์ที่ sync กับ Google Sheets (ตัวจริง) อยู่เสมอ
   ที่นั่งที่จองแล้วเก็บแยกตาม "รอบการแสดง" (showtimeId) เพราะแต่ละรอบล็อกที่นั่งอิสระจากกัน
   ========================================================================== */

const Storage = (() => {
  const KEY_BOOKED_SEATS_MAP = "khon_booked_seats_by_showtime_v2";
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
    /** ทั้งแผนที่ที่นั่งจองแล้วของทุกรอบ { showtimeId: [seatId, ...] } */
    getBookedSeatsMap() {
      return safeGet(KEY_BOOKED_SEATS_MAP, {});
    },
    setBookedSeatsMap(map) {
      safeSet(KEY_BOOKED_SEATS_MAP, map || {});
    },

    /** คืน Set ของรหัสที่นั่งที่ถูกจองแล้วของรอบที่ระบุ (จาก cache ล่าสุดในเครื่องนี้) */
    getBookedSeats(showtimeId) {
      const map = this.getBookedSeatsMap();
      return new Set(map[showtimeId] || []);
    },
    /** เพิ่มที่นั่งเข้า cache ของรอบนั้นแบบ optimistic ก่อนได้รับคำตอบจากเซิร์ฟเวอร์ */
    addBookedSeats(showtimeId, seatIds) {
      const map = this.getBookedSeatsMap();
      const current = new Set(map[showtimeId] || []);
      seatIds.forEach(id => current.add(id));
      map[showtimeId] = Array.from(current);
      this.setBookedSeatsMap(map);
    },
    /** ถอนที่นั่งออกจาก cache ของรอบนั้น (ใช้ตอน rollback เมื่อจองไม่สำเร็จ) */
    removeBookedSeats(showtimeId, seatIds) {
      const map = this.getBookedSeatsMap();
      const current = new Set(map[showtimeId] || []);
      seatIds.forEach(id => current.delete(id));
      map[showtimeId] = Array.from(current);
      this.setBookedSeatsMap(map);
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
