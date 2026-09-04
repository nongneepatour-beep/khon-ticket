/* ==========================================================================
   config.js — จุดตั้งค่าเดียวของทั้งระบบ
   แก้ราคา / จำนวนที่นั่ง / URL Google Apps Script ได้จากไฟล์นี้ไฟล์เดียว
   ========================================================================== */

/* วาง URL Web App ของ Google Apps Script ที่ได้หลัง Deploy (ลงท้ายด้วย /exec)
   ดูวิธีสร้างและ deploy ได้ในไฟล์ README.md ที่ root ของโปรเจกต์ */
const API_URL = "https://script.google.com/macros/s/AKfycbw6Dg39-XA5N2gSIlahzDPK3NuK9Mh1ehC6y95Dh483RYQPxPaV1Cp3izonS3F4EK61aw/exec";

/* ข้อมูลการแสดง (ชื่อเรื่อง/สถานที่) — แสดงผลบนหน้าเว็บเฉยๆ ไม่กระทบ logic การล็อกที่นั่ง */
const SHOW_INFO = {
  title: "รามเกียรติ์ ตอน พระรามรบทศกัณฐ์ (ยกรบ)",
  venue: "ณ หอประชุม ศรีพฤทเธศวรเธียเตอร์",
  summary: "จัดแสดงวันที่ 10–11 ตุลาคม 2569 · รอบเช้า 09:00 น. และรอบบ่าย 14:00 น."
};

/* รอบการแสดงที่เปิดให้จอง — เพิ่ม/ลบ/แก้ข้อความได้อิสระ
   ⚠️ ห้ามแก้ id ของรอบที่เคยมีคนจองไปแล้ว เพราะ id ผูกกับการล็อกที่นั่งใน Google Sheets อยู่
   (จะเพิ่มรอบใหม่ทีหลังได้เสมอ แค่ห้ามเปลี่ยน/ลบ id เดิมที่มีการจองค้างอยู่) */
const SHOWTIMES = [
  { id: "2026-10-10-morning", label: "วันที่ 10 ตุลาคม 2569 · รอบเช้า 09:00 น." },
  { id: "2026-10-10-afternoon", label: "วันที่ 10 ตุลาคม 2569 · รอบบ่าย 14:00 น." },
  { id: "2026-10-11-morning", label: "วันที่ 11 ตุลาคม 2569 · รอบเช้า 09:00 น." },
  { id: "2026-10-11-afternoon", label: "วันที่ 11 ตุลาคม 2569 · รอบบ่าย 14:00 น." }
];
const SHOWTIME_BY_ID = new Map(SHOWTIMES.map(st => [st.id, st]));

/* ราคาต่อที่นั่งตามประเภทโซน (บาท) — แก้ตัวเลขตรงนี้ได้เลย */
const PRICES = {
  vip: 499,
  purple: 129,
  green: 99,
  yellow: 59
};

/* ข้อมูลการแสดงผลของแต่ละประเภทโซน */
const ZONE_META = {
  vip:    { label: "VIP",            className: "zone-vip" },
  purple: { label: "ธรรมดาสีม่วง",   className: "zone-purple" },
  green:  { label: "ธรรมดาสีเขียว",  className: "zone-green" },
  yellow: { label: "ธรรมดาสีเหลือง", className: "zone-yellow" }
};

/* ผังที่นั่ง — โซน A อยู่ฝั่งขวามือผู้ชมเสมอ, B กลาง, C ซ้าย
   ลำดับ key ใน rows คือลำดับแถวจากเวทีออกไปด้านหลัง
   ห้ามแก้ id หลัง deploy จริงแล้ว เพราะ id ผูกกับที่นั่งที่ถูกจองไปแล้วใน Google Sheets */
const SEAT_LAYOUT = [
  // ---------- โซน VIP (สีแดง) ----------
  { id: "vip-right",  name: "โซน A1 · VIP ฝั่งขวา",  type: "vip", rows: { A: 11, B: 11, C: 12, D: 12 } },
  { id: "vip-center", name: "โซน B1 · VIP กลาง",      type: "vip", rows: { A: 13, B: 14, C: 14, D: 15, E: 15, F: 16, G: 16, H: 17, I: 17 } },
  { id: "vip-left",   name: "โซน C1 · VIP ฝั่งซ้าย",  type: "vip", rows: { A: 10, B: 10, C: 11, D: 11 } },

  // ---------- โซนธรรมดาสีม่วง (ไม่มีโซนกลาง เป็นทางเดิน) ----------
  { id: "purple-right", name: "โซน A2 · ธรรมดาฝั่งขวา", type: "purple", rows: { E: 13, F: 14, G: 14, H: 15, I: 15 } },
  { id: "purple-aisle", name: "ทางเดินกลาง",             type: "aisle",  rows: {} },
  { id: "purple-left",  name: "โซน C2 · ธรรมดาฝั่งซ้าย", type: "purple", rows: { E: 12, F: 13, G: 13, H: 14, I: 14 } },

  // ---------- โซนธรรมดาสีเขียว ----------
  { id: "green-right",  name: "โซน A3 · ธรรมดาฝั่งขวา", type: "green", rows: { J: 17, K: 17, L: 18, M: 18 } },
  { id: "green-center", name: "โซน B3 · ธรรมดากลาง",    type: "green", rows: { J: 19, K: 19, L: 20, M: 20 } },
  { id: "green-left",   name: "โซน C3 · ธรรมดาฝั่งซ้าย", type: "green", rows: { J: 16, K: 16, L: 17, M: 17 } },

  // ---------- โซนธรรมดาสีเหลือง ----------
  { id: "yellow-right",  name: "โซน A4 · ธรรมดาฝั่งขวา", type: "yellow", rows: { N: 19, O: 19, P: 20, Q: 21 } },
  { id: "yellow-center", name: "โซน B4 · ธรรมดากลาง",    type: "yellow", rows: { N: 21, O: 22, P: 22, Q: 23 } },
  { id: "yellow-left",   name: "โซน C4 · ธรรมดาฝั่งซ้าย", type: "yellow", rows: { N: 18, O: 19, P: 19, Q: 20 } }
];

/* จัดกลุ่มเป็น "แถวเวที" ละ 3 คอลัมน์ (ซ้าย-กลาง-ขวา) เพื่อ render เป็นเฟรมเดียวกัน
   ลำดับ id ในนี้ = ลำดับคอลัมน์บนจอ ซ้ายสุด → ขวาสุด (ทำให้ A อยู่ขวาสุดเสมอ) */
const SEAT_TIERS = [
  ["vip-left", "vip-center", "vip-right"],
  ["purple-left", "purple-aisle", "purple-right"],
  ["green-left", "green-center", "green-right"],
  ["yellow-left", "yellow-center", "yellow-right"]
];

/* สร้างรายการที่นั่งทั้งหมดจาก SEAT_LAYOUT (ไม่ต้องแก้ส่วนนี้) */
const ALL_SEATS = [];
SEAT_LAYOUT.forEach(zone => {
  Object.entries(zone.rows).forEach(([row, count]) => {
    for (let number = 1; number <= count; number++) {
      ALL_SEATS.push({
        id: `${zone.id}-${row}-${number}`,
        zoneId: zone.id,
        zoneName: zone.name,
        type: zone.type,
        row,
        number,
        price: PRICES[zone.type] || 0
      });
    }
  });
});
const SEAT_BY_ID = new Map(ALL_SEATS.map(seat => [seat.id, seat]));

/* จำกัดขนาด/ชนิดไฟล์สลิปที่แนบได้ */
const SLIP_MAX_BYTES = 750 * 1024;
const SLIP_ALLOWED_TYPES = ["image/png", "image/jpeg", "application/pdf"];
