# ระบบจองตั๋วชมโขนไทย (Khon Ticket Booking)

เว็บจองตั๋วชมการแสดงโขน ธีมดำ–ทอง มีผังที่นั่งแบบโรงหนัง (VIP / ธรรมดาสีม่วง / เขียว / เหลือง),
ระบบแนบสลิปโอนเงิน, และหลังบ้าน (Admin) สำหรับตรวจสอบ/อนุมัติการจอง

ใช้ **Google Sheets** เป็นฐานข้อมูล ผ่าน **Google Apps Script** (ฟรี ไม่ต้องมีเซิร์ฟเวอร์ของตัวเอง)
และ deploy หน้าเว็บ (static) ขึ้น **Vercel** ผ่าน **GitHub**

โค้ดที่มีในโปรเจกต์เดิม (`index.html`, `index (3).html`, `index(4) (1).html` ที่ root) เป็นไฟล์ต้นแบบ
เดิม **ไม่เกี่ยวข้องกับเว็บใหม่นี้** เว็บใหม่ทั้งหมดอยู่ในโฟลเดอร์ [`public/`](public/) และ [`apps-script/`](apps-script/)

```
public/                  ← เว็บที่ deploy จริง (Vercel root directory = public)
  index.html               หน้าจองตั๋ว (สาธารณะ)
  admin.html                หน้าแอดมิน (ต้องล็อกอิน)
  assets/css/                ธีม + สไตล์ผังที่นั่ง
  assets/js/
    config.js                 ← แก้ราคา/ผังที่นั่ง/URL Apps Script ที่นี่
    storage.js, api.js, seatmap.js, booking.js, admin.js
apps-script/
  Code.gs                   ← โค้ดฝั่งเซิร์ฟเวอร์ (วางใน script.google.com)
```

---

## ขั้นตอนที่ 1 — สร้าง Google Sheet + Apps Script

1. เปิด [Google Sheets](https://sheets.new) สร้างชีตใหม่ ตั้งชื่อว่าอะไรก็ได้ เช่น `Khon Ticket DB`
2. เมนู **ส่วนขยาย (Extensions) → Apps Script**
3. ลบโค้ดตัวอย่าง (`myFunction() {}`) ออกให้หมด แล้ววางโค้ดทั้งหมดจากไฟล์
   [`apps-script/Code.gs`](apps-script/Code.gs) ของโปรเจกต์นี้ลงไปแทน
4. กด 💾 บันทึกโปรเจกต์ (ตั้งชื่อ เช่น `Khon Ticket API`)

## ขั้นตอนที่ 2 — ตั้งรหัสผ่านแอดมิน

รหัสผ่านแอดมิน **ไม่ได้เก็บเป็นข้อความล้วนที่ไหนเลย** เก็บเป็นค่า hash (SHA-256) ใน
Script Properties ของ Apps Script เท่านั้น (ไม่ขึ้น GitHub ไม่ขึ้น Sheet)

1. ในตัวแก้ไข Apps Script เปิดไฟล์ `Code.gs` หาไฟล์ฟังก์ชัน `generateAdminPasswordHash()`
2. แก้บรรทัด `const password = "..."` ให้เป็นรหัสผ่านที่ต้องการใช้จริง
3. เลือกฟังก์ชัน `generateAdminPasswordHash` จาก dropdown ด้านบน แล้วกด **▶ Run**
   (ครั้งแรกจะมี popup ขอสิทธิ์ ให้กด Allow)
4. เปิด **View → Logs** (หรือ Ctrl+Enter) จะเห็นค่า hash ยาวๆ ให้คัดลอกไว้
5. ไปที่ ⚙️ **Project Settings → Script Properties → Add script property**
   - Property: `ADMIN_PASSWORD_HASH`
   - Value: (ค่า hash ที่คัดลอกมา)
6. **ลบรหัสผ่านออกจากบรรทัด `const password = "..."`** ในโค้ด (หรือแก้กลับเป็นข้อความเปล่า) เพื่อไม่ให้
   รหัสผ่านจริงค้างอยู่ในซอร์สโค้ด แล้วบันทึกอีกครั้ง

> ต้องการเปลี่ยนรหัสผ่านทีหลัง? ทำซ้ำขั้นตอนนี้แล้วอัปเดตค่า `ADMIN_PASSWORD_HASH` ใหม่ได้ทุกเมื่อ
> ไม่ต้อง deploy ใหม่

## ขั้นตอนที่ 3 — Deploy เป็น Web App

1. มุมขวาบน กด **Deploy → New deployment**
2. เลือกไอคอนรูปเฟือง ⚙️ ข้าง "Select type" → เลือก **Web app**
3. ตั้งค่า:
   - **Execute as**: Me (อีเมลของคุณ)
   - **Who has access**: Anyone
4. กด **Deploy** → อนุมัติสิทธิ์การเข้าถึง Sheet/Drive ตามที่ระบบขอ
5. คัดลอก **Web app URL** ที่ได้ (หน้าตาแบบ `https://script.google.com/macros/s/AKfycb.../exec`)

> ทุกครั้งที่แก้โค้ด `Code.gs` แล้วอยากให้มีผลจริง ต้องกด **Deploy → Manage deployments →
> แก้ไข (ไอคอนดินสอ) → New version → Deploy** ใหม่ (แก้โค้ดเฉยๆ ไม่ New version จะไม่มีผล)

## ขั้นตอนที่ 4 — เชื่อม URL เข้าเว็บ

เปิดไฟล์ [`public/assets/js/config.js`](public/assets/js/config.js) แก้บรรทัดแรกสุด:

```js
const API_URL = "https://script.google.com/macros/s/PASTE_YOUR_DEPLOYMENT_ID_HERE/exec";
```

เปลี่ยนเป็น URL ที่คัดลอกมาจากขั้นตอนที่ 3 (URL นี้ไม่ใช่ความลับ ใส่ตรงๆ ในโค้ดที่ push ขึ้น GitHub ได้ —
ความปลอดภัยของฝั่งแอดมินอยู่ที่รหัสผ่าน/ token ไม่ใช่ที่ URL นี้)

**แก้ราคา/จำนวนที่นั่ง**: ไฟล์เดียวกันนี้ (`config.js`) มีตัวแปร `PRICES` และ `SEAT_LAYOUT`
แก้ตัวเลขตรงนั้นได้เลย หน้าเว็บ (ผังที่นั่ง + ตารางราคา) จะอัปเดตตามอัตโนมัติ — **ห้ามแก้ `id` ของโซน**
หลังจากมีคนจองจริงแล้ว เพราะ `id` ผูกกับที่นั่งที่บันทึกไว้ใน Google Sheets

## ขั้นตอนที่ 5 — ทดสอบก่อนขึ้นจริง

เปิด `public/index.html` ด้วยเซิร์ฟเวอร์ static ง่ายๆ (เปิดไฟล์ตรงๆ ด้วย `file://` อาจติดปัญหา CORS
ของเบราว์เซอร์บางตัว แนะนำใช้เซิร์ฟเวอร์เล็กๆ แทน):

```bash
cd public
npx serve .
# หรือ
python -m http.server 5500
```

แล้วเปิด `http://localhost:5500` (หรือพอร์ตที่ขึ้น) → ลองเลือกที่นั่ง กรอกฟอร์ม แนบสลิป กดยืนยันการจอง →
เช็คว่ามีแถวใหม่ขึ้นใน Google Sheet และไฟล์สลิปขึ้นใน Google Drive (โฟลเดอร์ `Khon Ticket Slips`)

ทดสอบฝั่งแอดมินที่ `http://localhost:5500/admin.html` ล็อกอินด้วยรหัสผ่านที่ตั้งไว้ในขั้นตอนที่ 2

---

## Deploy ขึ้น Vercel ผ่าน GitHub

1. Commit โฟลเดอร์ `public/`, `apps-script/`, `README.md` แล้ว push ขึ้น GitHub repo:
   ```bash
   git add public apps-script README.md
   git commit -m "Add khon ticket booking site"
   git push origin main
   ```
2. เข้า [vercel.com](https://vercel.com) → **Add New → Project** → เลือก import repo GitHub นี้
3. ในหน้าตั้งค่าโปรเจกต์:
   - **Framework Preset**: Other
   - **Root Directory**: `public`   ← สำคัญ! ต้องชี้มาที่โฟลเดอร์นี้ ไม่ใช่ root ของ repo
   - **Build Command / Output Directory**: เว้นว่างไว้ (ไม่ต้อง build เพราะเป็น static site ล้วน)
4. กด **Deploy** — เสร็จแล้วจะได้โดเมน `https://<ชื่อโปรเจกต์>.vercel.app`
5. หลังจากนี้ **push ขึ้น `main` เมื่อไหร่ Vercel จะ deploy ให้อัตโนมัติทุกครั้ง**

ต้องการโดเมนของตัวเอง: ไปที่ Project → Settings → Domains แล้วเพิ่มโดเมนได้ตามปกติ

---

## โครงสร้างข้อมูลใน Google Sheet (ชีต `Bookings`)

สร้างอัตโนมัติโดย `Code.gs` เมื่อมีการจองครั้งแรก มีคอลัมน์:

| คอลัมน์ | ความหมาย |
|---|---|
| `booking_id` | เลขที่การจอง (สร้างอัตโนมัติ เช่น `KHON-20261010-AB12CD`) |
| `seats` | รหัสที่นั่ง คั่นด้วย `\|` เช่น `vip-right-A-1\|vip-right-A-2` |
| `seat_zones`, `seat_count`, `total_price` | สรุปที่นั่ง/ยอดเงิน |
| `first_name`, `last_name`, `phone`, `email` | ข้อมูลผู้จอง |
| `payment_method`, `payment_amount_declared` | วิธีชำระเงินและยอดที่ผู้จองแจ้ง |
| `slip_drive_file_id`, `slip_url` | ไฟล์สลิปที่อัปโหลดไว้ใน Google Drive |
| `booking_status` | `รอตรวจสอบการชำระเงิน` → `อนุมัติแล้ว` / `ปฏิเสธแล้ว` |
| `reject_reason`, `updated_at` | เหตุผลตอนปฏิเสธ / เวลาที่อัปเดตสถานะล่าสุด |

## ความปลอดภัย (สรุปสั้นๆ)

- รหัสผ่านแอดมินเก็บเป็น hash เท่านั้น ไม่มีที่ไหนเก็บ plaintext (ไม่อยู่ใน Sheet, ไม่อยู่ใน repo)
- Token ของแอดมินหมดอายุอัตโนมัติใน 6 ชั่วโมง (`CacheService`) และเก็บฝั่งไคลเอนต์ใน `sessionStorage`
  (หายเมื่อปิดแท็บ)
- Endpoint สาธารณะ (`action=seats`) คืนแค่รหัสที่นั่งที่ถูกจอง **ไม่มีชื่อ/เบอร์โทร/อีเมลของใครหลุดออกไป**
  ข้อมูลลูกค้าเต็มดูได้เฉพาะผ่าน `action=adminList` ที่ต้องมี token เท่านั้น
- การกันที่นั่งจองซ้ำตรวจสอบที่ **ฝั่งเซิร์ฟเวอร์ (Apps Script) เป็นหลัก** ผ่าน `LockService`
  (การเช็กฝั่งหน้าเว็บเป็นแค่ UX ให้ตอบสนองเร็ว ไม่ใช่ตัวตัดสินจริง)
- เก็บสถานะที่นั่ง/ประวัติการจองของผู้ใช้ไว้ใน `localStorage` ของเบราว์เซอร์เพื่อให้หน้าเว็บโหลดเร็วและใช้ได้
  แม้เน็ตช้า แต่ **Google Sheets คือแหล่งข้อมูลจริงเสมอ** หน้าเว็บจะซิงก์ทับ cache ทุก ~15 วินาที

## แก้ปัญหาที่พบบ่อย

- **"ยังไม่ได้ตั้งค่า API_URL"** — ยังไม่ได้แก้ `API_URL` ใน `config.js` หรือ URL ไม่ได้ลงท้ายด้วย `/exec`
- **จองแล้วไม่ขึ้นใน Sheet / ล็อกอินแอดมินไม่ได้** — เช็คว่า Deploy เวอร์ชันล่าสุดแล้ว (แก้โค้ดต้องกด
  New version ทุกครั้ง ตามขั้นตอนที่ 3) และ Access ตั้งเป็น *Anyone* จริง
- **รูปสลิปไม่ขึ้นในหน้าแอดมิน** — เช็คสิทธิ์แชร์ไฟล์ใน Google Drive โฟลเดอร์ `Khon Ticket Slips` (โค้ด
  ตั้งเป็น "ทุกคนที่มีลิงก์ดูได้" ให้อัตโนมัติ ถ้ามีการเปลี่ยนสิทธิ์ Drive ขององค์กรอาจบล็อกได้)
- **ล็อกอินแอดมินบอกรหัสผ่านผิดตลอด** — ตรวจว่า Script Property `ADMIN_PASSWORD_HASH` ตั้งค่าไว้แล้วจริง
  และ hash ตรงกับรหัสผ่านที่ใช้ล็อกอิน (ทำขั้นตอนที่ 2 ใหม่ได้เสมอ)
