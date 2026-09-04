/**
 * ============================================================================
 * Code.gs — Google Apps Script backend สำหรับระบบจองตั๋วชมโขนไทย
 * วิธี deploy: ดูขั้นตอนละเอียดในไฟล์ README.md ที่ root ของโปรเจกต์
 * ============================================================================
 */

const SHEET_NAME = "Bookings";
const DRIVE_FOLDER_NAME = "Khon Ticket Slips";
const ADMIN_TOKEN_TTL_SECONDS = 6 * 60 * 60; // token แอดมินอยู่ได้ 6 ชั่วโมง

// สถานะที่ถือว่า "ล็อกที่นั่งไว้แล้ว" (คนอื่นจองซ้ำไม่ได้)
const LOCKED_STATUSES = ["รอตรวจสอบการชำระเงิน", "อนุมัติแล้ว"];

const HEADERS = [
  "booking_id", "created_at", "seats", "seat_zones", "seat_count", "total_price",
  "first_name", "last_name", "phone", "payment_method", "payment_amount_declared",
  "slip_drive_file_id", "slip_url", "booking_status", "reject_reason", "updated_at"
];

/* ------------------------------ Entry points ------------------------------ */

function doGet(e) {
  const action = e.parameter.action;
  try {
    if (action === "seats") return respond_(handleGetSeats_());
    if (action === "adminList") return respond_(handleAdminList_(e.parameter.token));
    return respond_({ ok: false, message: "ไม่รู้จักคำสั่งนี้ (action=" + action + ")" });
  } catch (error) {
    return respond_({ ok: false, message: "เกิดข้อผิดพลาด: " + error.message });
  }
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (error) {
    return respond_({ ok: false, message: "รูปแบบข้อมูลที่ส่งมาไม่ถูกต้อง" });
  }

  try {
    switch (body.action) {
      case "create":
        return respond_(handleCreateBooking_(body.record || {}));
      case "adminLogin":
        return respond_(handleAdminLogin_(body.password || ""));
      case "adminUpdateStatus":
        return respond_(handleAdminUpdateStatus_(body));
      default:
        return respond_({ ok: false, message: "ไม่รู้จักคำสั่งนี้ (action=" + body.action + ")" });
    }
  } catch (error) {
    return respond_({ ok: false, message: "เกิดข้อผิดพลาด: " + error.message });
  }
}

/* --------------------------------- Public --------------------------------- */

/** คืนแค่ "รหัสที่นั่ง" ที่ถูกล็อกแล้ว ไม่มีข้อมูลลูกค้าติดไปด้วย (ป้องกันข้อมูลรั่วไหล) */
function handleGetSeats_() {
  const sheet = getSheet_();
  const records = readAllRecords_(sheet);
  return { ok: true, bookedSeatIds: getLockedSeatIds_(records) };
}

/** สร้างรายการจองใหม่ พร้อมตรวจที่นั่งชนกันซ้ำฝั่งเซิร์ฟเวอร์ (authoritative) และอัปโหลดสลิปขึ้น Drive */
function handleCreateBooking_(record) {
  const requiredFields = ["booking_id", "seats", "first_name", "last_name", "phone", "payment_method", "total_price"];
  for (const field of requiredFields) {
    if (!record[field] && record[field] !== 0) return { ok: false, message: "ข้อมูลไม่ครบถ้วน: " + field };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000); // กันการเขียนชนกันเมื่อมีคนจองพร้อมกันหลายคน
  try {
    const sheet = getSheet_();
    const records = readAllRecords_(sheet);

    if (records.some(r => r.booking_id === record.booking_id)) {
      return { ok: false, message: "พบเลขที่การจองซ้ำ กรุณาลองใหม่อีกครั้ง" };
    }

    const lockedSeatIds = new Set(getLockedSeatIds_(records));
    const requestedSeatIds = String(record.seats).split("|").map(s => s.trim()).filter(Boolean);
    const conflictSeats = requestedSeatIds.filter(id => lockedSeatIds.has(id));

    if (conflictSeats.length) {
      return {
        ok: false,
        conflict: true,
        message: "ที่นั่ง " + conflictSeats.join(", ") + " ถูกจองไปแล้ว กรุณาเลือกที่นั่งใหม่",
        bookedSeatIds: Array.from(lockedSeatIds)
      };
    }

    let slipDriveFileId = "";
    let slipUrl = "";
    if (record.slip_data) {
      const saved = saveSlipToDrive_(record.booking_id, record.slip_filename, record.slip_mime, record.slip_data);
      slipDriveFileId = saved.fileId;
      slipUrl = saved.url;
    }

    const now = new Date().toISOString();
    const row = HEADERS.map(key => {
      if (key === "slip_drive_file_id") return slipDriveFileId;
      if (key === "slip_url") return slipUrl;
      if (key === "booking_status") return record.booking_status || "รอตรวจสอบการชำระเงิน";
      if (key === "reject_reason") return "";
      if (key === "updated_at") return now;
      return record[key] !== undefined ? record[key] : "";
    });
    sheet.appendRow(row);

    return {
      ok: true,
      record: {
        booking_id: record.booking_id,
        seats: record.seats,
        seat_count: record.seat_count,
        total_price: record.total_price,
        booking_status: "รอตรวจสอบการชำระเงิน"
      }
    };
  } finally {
    lock.releaseLock();
  }
}

/* --------------------------------- Admin ---------------------------------- */

function handleAdminLogin_(password) {
  const storedHash = PropertiesService.getScriptProperties().getProperty("ADMIN_PASSWORD_HASH");
  if (!storedHash) return { ok: false, message: "ยังไม่ได้ตั้งค่ารหัสผ่านแอดมิน (ADMIN_PASSWORD_HASH) ใน Script Properties" };
  if (hashPassword_(password) !== storedHash) return { ok: false, message: "รหัสผ่านไม่ถูกต้อง" };

  const token = Utilities.getUuid();
  CacheService.getScriptCache().put("admin_" + token, "1", ADMIN_TOKEN_TTL_SECONDS);
  return { ok: true, token };
}

function handleAdminList_(token) {
  if (!isValidAdminToken_(token)) return { ok: false, message: "กรุณาเข้าสู่ระบบใหม่ (token หมดอายุ)" };
  const sheet = getSheet_();
  return { ok: true, records: readAllRecords_(sheet) };
}

function handleAdminUpdateStatus_(body) {
  if (!isValidAdminToken_(body.token)) return { ok: false, message: "กรุณาเข้าสู่ระบบใหม่ (token หมดอายุ)" };

  const nextStatus = body.status;
  if (nextStatus === "ปฏิเสธแล้ว" && !String(body.reject_reason || "").trim()) {
    return { ok: false, message: "กรุณาระบุเหตุผลก่อนปฏิเสธรายการ" };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = getSheet_();
    const values = sheet.getDataRange().getValues();
    const header = values[0];
    const rowIndex = values.findIndex((row, i) => i > 0 && row[header.indexOf("booking_id")] === body.booking_id);
    if (rowIndex === -1) return { ok: false, message: "ไม่พบรายการจองนี้" };

    const targetRow = values[rowIndex];
    const record = {};
    header.forEach((key, i) => (record[key] = targetRow[i]));

    if (nextStatus === "อนุมัติแล้ว") {
      const records = readAllRecords_(sheet).filter(r => r.booking_id !== body.booking_id);
      const lockedSeatIds = new Set(getLockedSeatIds_(records));
      const mySeats = String(record.seats).split("|").map(s => s.trim()).filter(Boolean);
      const conflict = mySeats.some(id => lockedSeatIds.has(id));
      if (conflict) return { ok: false, message: "ไม่สามารถอนุมัติได้ เนื่องจากมีที่นั่งในรายการนี้ถูกจองโดยรายการอื่นไปแล้ว" };
    }

    const now = new Date().toISOString();
    sheet.getRange(rowIndex + 1, header.indexOf("booking_status") + 1).setValue(nextStatus);
    sheet.getRange(rowIndex + 1, header.indexOf("reject_reason") + 1).setValue(nextStatus === "ปฏิเสธแล้ว" ? body.reject_reason : "");
    sheet.getRange(rowIndex + 1, header.indexOf("updated_at") + 1).setValue(now);

    return { ok: true, record: { booking_id: body.booking_id, booking_status: nextStatus } };
  } finally {
    lock.releaseLock();
  }
}

/** เรียกฟังก์ชันนี้เองครั้งเดียวจาก Apps Script editor (เลือกฟังก์ชันนี้แล้วกด Run)
 *  เพื่อสร้าง hash ของรหัสผ่านที่ต้องการ แล้วนำค่าที่ได้ไปตั้งใน
 *  Project Settings > Script Properties > ADMIN_PASSWORD_HASH */
function generateAdminPasswordHash() {
  const password = "เปลี่ยนเป็นรหัสผ่านที่ต้องการก่อน Run"; // แก้ตรงนี้ก่อนรัน
  Logger.log(hashPassword_(password));
}

/* -------------------------------- Helpers ---------------------------------- */

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  ensureHeader_(sheet);
  return sheet;
}

function ensureHeader_(sheet) {
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
}

function readAllRecords_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const header = values[0];
  return values.slice(1).map(row => {
    const record = {};
    header.forEach((key, i) => (record[key] = row[i]));
    return record;
  }).filter(r => r.booking_id);
}

function getLockedSeatIds_(records) {
  const ids = [];
  records.forEach(record => {
    if (!LOCKED_STATUSES.includes(record.booking_status)) return;
    String(record.seats || "").split("|").map(s => s.trim()).filter(Boolean).forEach(id => ids.push(id));
  });
  return ids;
}

function isValidAdminToken_(token) {
  if (!token) return false;
  return CacheService.getScriptCache().get("admin_" + token) === "1";
}

function hashPassword_(password) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(password), Utilities.Charset.UTF_8);
  return digest.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, "0")).join("");
}

/** decode base64 data URL แล้วบันทึกเป็นไฟล์ใน Google Drive (โฟลเดอร์เดียวกันทุกไฟล์) */
function saveSlipToDrive_(bookingId, filename, mimeType, dataUrl) {
  const base64 = String(dataUrl).split(",")[1] || "";
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType || "image/jpeg", `${bookingId}_${filename || "slip"}`);
  const folder = getOrCreateSlipFolder_();
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return {
    fileId: file.getId(),
    url: "https://drive.google.com/uc?export=view&id=" + file.getId()
  };
}

function getOrCreateSlipFolder_() {
  const iter = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  if (iter.hasNext()) return iter.next();
  return DriveApp.createFolder(DRIVE_FOLDER_NAME);
}

function respond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
