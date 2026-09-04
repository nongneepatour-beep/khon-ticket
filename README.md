# ระบบจองตั๋วชมโขนไทย (Khon Ticket Booking)

เว็บจองตั๋วชมการแสดงโขน ธีมดำ–ทอง มีผังที่นั่งแบบโรงหนัง (VIP / ธรรมดาสีม่วง / เขียว / เหลือง) พร้อมระบบชำระเงิน
(พร้อมเพย์ QR / โอนธนาคาร), แนบสลิป, ออกหลักฐานการจองเป็นรูปภาพให้ผู้จองเก็บไว้เช็คหน้างาน และหลังบ้าน
(Admin) สำหรับตรวจสอบ/อนุมัติการจอง พร้อมช่องค้นหาเลขที่การจองไว้เช็คหน้างานอีกชั้น

ใช้ **Google Sheets** เป็นฐานข้อมูลทั้งหมด ผ่าน **Google Apps Script Web App** (ฟรี ไม่ต้องมีเซิร์ฟเวอร์ของตัวเอง)
และ deploy หน้าเว็บ (static) ขึ้น **Vercel**

> ไฟล์ `index.html`, `index (3).html`, `index(4) (1).html` ที่ root เป็นไฟล์ต้นแบบเก่า **ไม่เกี่ยวกับเว็บที่ deploy จริง**
> เว็บจริงทั้งหมดอยู่ในโฟลเดอร์ `public/` เท่านั้น

## ระบบทำงานยังไง (ภาพรวม)

1. หน้า **`public/index.html`** โหลดผังที่นั่งจาก `config.js` แล้วขอสถานะที่นั่งล่าสุดจาก Apps Script
   (`action=seats`) มาทับ cache ที่เก็บไว้ใน `localStorage` ของเบราว์เซอร์ — ทำให้ผังขึ้นเร็วและใช้ได้แม้เน็ตช้า
   แล้ว sync ซ้ำทุก ~15 วิ
2. ผู้ใช้เลือกที่นั่ง กรอกฟอร์ม แนบสลิป กด "ยืนยันการจอง" → บันทึกลง `localStorage` ทันที (optimistic) พร้อมส่ง
   ไป Apps Script (`action=create`) ซึ่งตรวจที่นั่งชนกันซ้ำอีกครั้งฝั่งเซิร์ฟเวอร์ (กันสองคนจองที่เดียวกันพร้อมกัน)
   แล้วอัปโหลดไฟล์สลิปขึ้น Google Drive โดยอัตโนมัติ
3. จองสำเร็จจะขึ้นการ์ด "หลักฐานการจอง" พร้อมปุ่มบันทึกเป็นรูปภาพ (ใช้ไลบรารี html2canvas) ให้ผู้จองเก็บไว้
   โชว์เจ้าหน้าที่หน้างานได้
4. **`public/admin.html`** ล็อกอินด้วยรหัสผ่าน (ตรวจสอบฝั่ง Apps Script ไม่ใช่ฝั่งเว็บ) เห็นรายการจองทั้งหมด
   พร้อมรูปสลิป มีช่องกรองตามสถานะ + ช่องค้นหาเลขที่การจอง (ใช้เช็คหน้างาน) และปุ่มอนุมัติ/ปฏิเสธ

## โครงสร้างไฟล์

```
khon-ticket/
├─ public/                        ← เว็บที่ deploy จริง (Vercel root directory = public)
│  ├─ index.html                    หน้าจองตั๋ว (public)
│  ├─ admin.html                    หน้าแอดมิน (ต้องล็อกอิน)
│  └─ assets/
│     ├─ css/theme.css                ธีมดำ-ทอง + override Bootstrap
│     ├─ css/seat-map.css             สไตล์ผังที่นั่งโดยเฉพาะ
│     ├─ img/promptpay-qr.jpg          รูป QR พร้อมเพย์ที่โชว์ตอนเลือกวิธีชำระเงิน
│     └─ js/
│        ├─ config.js                   ★ จุดตั้งค่าเดียวของทั้งระบบ (ดูหัวข้อถัดไป)
│        ├─ storage.js                  จัดการ localStorage (cache ที่นั่ง/ประวัติการจอง)
│        ├─ api.js                      fetch wrapper เรียก Apps Script
│        ├─ seatmap.js                  render ผังที่นั่งจาก config
│        ├─ booking.js                  ฟอร์มจอง + validate + บันทึกรูปหลักฐาน
│        └─ admin.js                    ล็อกอิน + แดชบอร์ด + ค้นหา + อนุมัติ/ปฏิเสธ
├─ apps-script/Code.gs             โค้ด Apps Script ทั้งหมด (คัดลอกไปวางใน script.google.com)
└─ README.md
```

## ไฟล์ตั้งค่า `public/assets/js/config.js`

ไฟล์เดียวที่ต้องแก้เพื่อปรับระบบ ไม่ต้องแตะไฟล์อื่น:

| ตัวแปร | ใช้ทำอะไร | แก้ได้อย่างอิสระไหม |
|---|---|---|
| `API_URL` | URL ของ Google Apps Script Web App (ต้องลงท้าย `/exec`) | ✅ แก้ได้เสมอเวลา deploy ใหม่ |
| `SHOW_INFO` | ชื่อการแสดง / สถานที่ / วันเวลา ที่โชว์บนหน้าเว็บ (รอบเดียว) | ✅ แก้ข้อความได้อิสระ |
| `PRICES` | ราคาต่อที่นั่งของแต่ละประเภทโซน (`vip` / `purple` / `green` / `yellow`) หน่วยบาท | ✅ แก้ตัวเลขได้อิสระ อัปเดตทั้งผังและตารางราคาอัตโนมัติ |
| `ZONE_META` | ชื่อที่แสดงผลของแต่ละประเภทโซน + class สีที่ใช้ในผัง | ✅ แก้ label ได้ แต่ `className` ต้องตรงกับ class ใน `seat-map.css` |
| `SEAT_LAYOUT` | ผังที่นั่งจริง: แต่ละโซนมี `id`, `name`, `type`, `rows` (แถว → จำนวนที่นั่ง) | ⚠️ แก้จำนวนที่นั่ง/ชื่อโซนได้ แต่ **ห้ามแก้ `id`** หลังมีการจองจริงแล้ว เพราะ `id` ผูกกับที่นั่งที่บันทึกไว้ใน Google Sheets อยู่ (`seats` คอลัมน์อ้างอิงด้วย id นี้) — ถ้าจะเปลี่ยนผังทั้งหมดควรเริ่ม Sheet ใหม่ |
| `SEAT_TIERS` | ลำดับซ้าย-กลาง-ขวาของแต่ละแถวเวที (คุมว่าโซน A อยู่ขวาสุดเสมอ) | ⚠️ แก้ได้แต่ต้องอ้าง `id` ที่มีจริงใน `SEAT_LAYOUT` |
| `SLIP_MAX_BYTES` / `SLIP_ALLOWED_TYPES` | ขนาด/ชนิดไฟล์สลิปที่ยอมให้แนบ | ✅ แก้ได้อิสระ |

`ALL_SEATS` และ `SEAT_BY_ID` ด้านล่างของไฟล์เป็นค่าที่คำนวณจาก `SEAT_LAYOUT` อัตโนมัติ **ไม่ต้องแก้เอง**

รูป QR พร้อมเพย์ (`assets/img/promptpay-qr.jpg`) กับเลขบัญชีธนาคารที่โชว์ตอนเลือกวิธีชำระเงิน อยู่ใน
`public/index.html` (ค้นคำว่า `promptpay-panel` / `bank-panel`) เปลี่ยนรูปหรือเลขบัญชีได้ตรงนั้น

## โครงสร้างข้อมูลใน Google Sheet (ชีต `Bookings`)

สร้างอัตโนมัติโดย `Code.gs` เมื่อมีการจองครั้งแรก:

`booking_id, created_at, seats, seat_zones, seat_count, total_price, first_name, last_name,
phone, email, payment_method, payment_amount_declared, slip_drive_file_id, slip_url,
booking_status, reject_reason, updated_at`

- `seats` = รหัสที่นั่งคั่นด้วย `|` (อ้างอิง `id` ใน `SEAT_LAYOUT`)
- `booking_status` วนสถานะ: `รอตรวจสอบการชำระเงิน` → `อนุมัติแล้ว` / `ปฏิเสธแล้ว`
- ไฟล์สลิปไม่ได้เก็บในชีต แต่อัปโหลดขึ้นโฟลเดอร์ Google Drive ชื่อ **"Khon Ticket Slips"** อัตโนมัติ
  ชีตเก็บแค่ลิงก์ (`slip_url`)

## ตั้งค่า Google Sheet + Apps Script (ทำครั้งเดียว)

> ข้ามได้ถ้า `API_URL` ใน `config.js` เป็น URL ที่ deploy จริงอยู่แล้ว — ส่วนนี้ไว้อ้างอิงตอนต้องแก้ไข/deploy ใหม่

1. เปิด [Google Sheets](https://sheets.new) → เมนู **Extensions > Apps Script**
2. ลบโค้ดตัวอย่างออก วางโค้ดทั้งหมดจาก [`apps-script/Code.gs`](apps-script/Code.gs) แทน แล้วบันทึก
3. **ตั้งรหัสผ่านแอดมิน** (เก็บเป็น hash เท่านั้น ไม่มี plaintext ที่ไหนเลย):
   - แก้ค่า `password` ในฟังก์ชัน `generateAdminPasswordHash()` เป็นรหัสที่ต้องการ → เลือกฟังก์ชันนี้จาก
     dropdown ด้านบน → กด **▶ Run** (ครั้งแรกต้องกด Allow ยืนยันสิทธิ์)
   - เปิด **Executions** (ไอคอนซ้ายมือ) ดู log จะได้ค่า hash → คัดลอก
   - ไปที่ ⚙️ **Project Settings > Script Properties > Add script property**: ตั้ง `ADMIN_PASSWORD_HASH` =
     ค่า hash ที่ได้ → ลบรหัสผ่าน plaintext ออกจากโค้ดแล้วบันทึกอีกครั้ง
   - เปลี่ยนรหัสผ่านทีหลังได้เสมอด้วยการทำซ้ำขั้นตอนนี้
4. **Deploy > New deployment** → เลือก **Web app** → Execute as: **Me**, Who has access: **Anyone** → Deploy
   → คัดลอก Web app URL (ลงท้าย `/exec`) ไปวางที่ `API_URL` ใน `config.js`
5. แก้โค้ด `Code.gs` ทีหลัง ต้องกด **Deploy > Manage deployments > แก้ไข (ดินสอ) > New version > Deploy**
   ใหม่ทุกครั้งถึงจะมีผลจริง (แก้โค้ดเฉยๆ ไม่พอ)

## Deploy ขึ้น Vercel

1. Commit + push โฟลเดอร์ `public/`, `apps-script/`, `README.md` ขึ้น GitHub repo นี้
2. เข้า [vercel.com](https://vercel.com) → **Add New → Project** → import repo นี้
3. ตั้งค่า: **Framework Preset = Other**, **Root Directory = `public`**, ไม่ต้องตั้ง Build Command
   (เป็น static site ล้วน ไม่มี build step)
4. กด **Deploy** → ได้โดเมน `https://<ชื่อโปรเจกต์>.vercel.app` ทันที
5. หลังจากนี้ push ขึ้น `main` เมื่อไหร่ Vercel deploy ให้อัตโนมัติทุกครั้ง (ต้องการโดเมนของตัวเองไปตั้งที่
   Project > Settings > Domains)

## ความปลอดภัย (สรุปสั้นๆ)

- รหัสผ่านแอดมินเก็บเป็น hash เท่านั้น ไม่อยู่ใน Sheet ไม่อยู่ใน repo
- Token แอดมินหมดอายุอัตโนมัติใน 6 ชม. เก็บฝั่งไคลเอนต์ใน `sessionStorage` (หายเมื่อปิดแท็บ)
- Endpoint สาธารณะ (`action=seats`) คืนแค่รหัสที่นั่ง ไม่มีข้อมูลลูกค้าหลุดออกไป — ข้อมูลเต็มดูได้เฉพาะผ่าน
  `action=adminList` ที่ต้องมี token
- กันที่นั่งจองซ้ำที่ **ฝั่งเซิร์ฟเวอร์เป็นหลัก** (`LockService` ใน Code.gs) การเช็กฝั่งหน้าเว็บเป็นแค่ UX

