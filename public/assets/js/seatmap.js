/* ==========================================================================
   seatmap.js — สร้างผังที่นั่งทั้งหมดในเฟรมเดียว จาก SEAT_LAYOUT / SEAT_TIERS
   ========================================================================== */

const SeatMap = (() => {
  let onToggleSeat = null;

  /** สร้าง DOM ของผังที่นั่งทั้งหมดครั้งเดียว แล้วผูก event คลิก */
  function render(container, { onToggle }) {
    onToggleSeat = onToggle;
    container.replaceChildren();

    const stage = document.createElement("div");
    stage.className = "stage";
    stage.textContent = "เวทีการแสดงโขน";
    container.appendChild(stage);

    const groups = document.createElement("div");
    groups.className = "seat-groups";

    SEAT_TIERS.forEach((tierIds, tierIndex) => {
      if (tierIndex > 0) {
        const note = document.createElement("p");
        note.className = "aisle-note";
        note.textContent = "— ช่องทางเดิน —";
        groups.appendChild(note);
      }

      const tierEl = document.createElement("div");
      tierEl.className = "seat-tier";

      tierIds.forEach(zoneId => {
        const zone = SEAT_LAYOUT.find(z => z.id === zoneId);
        if (!zone) return;

        if (zone.type === "aisle") {
          const aisleCol = document.createElement("div");
          aisleCol.className = "aisle-col";
          aisleCol.innerHTML = '<span class="aisle-note">ทางเดิน</span>';
          tierEl.appendChild(aisleCol);
          return;
        }

        tierEl.appendChild(buildZoneCard(zone));
      });

      groups.appendChild(tierEl);
    });

    container.appendChild(groups);
  }

  function buildZoneCard(zone) {
    const meta = ZONE_META[zone.type];
    const card = document.createElement("section");
    card.className = `zone-card ${meta.className}`;

    const title = document.createElement("div");
    title.className = "zone-title";
    title.textContent = zone.name;
    card.appendChild(title);

    const rows = document.createElement("div");
    rows.className = "rows";

    Object.entries(zone.rows).forEach(([row, count]) => {
      const rowEl = document.createElement("div");
      rowEl.className = "seat-row";

      const label = document.createElement("span");
      label.className = "row-label";
      label.textContent = row;
      rowEl.appendChild(label);

      const run = document.createElement("div");
      run.className = "seat-run";
      for (let number = 1; number <= count; number++) {
        const id = `${zone.id}-${row}-${number}`;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "seat";
        button.dataset.seatId = id;
        button.textContent = String(number);
        button.addEventListener("click", () => onToggleSeat && onToggleSeat(id));
        run.appendChild(button);
      }
      rowEl.appendChild(run);
      rows.appendChild(rowEl);
    });

    card.appendChild(rows);
    return card;
  }

  /** อัปเดตสถานะสี/disabled ของทุกปุ่มที่นั่ง โดยไม่สร้าง DOM ใหม่ (เร็ว ใช้ตอน poll ซ้ำได้) */
  function updateStates(container, { selectedSeats, bookedSeats }) {
    container.querySelectorAll(".seat").forEach(button => {
      const id = button.dataset.seatId;
      const seat = SEAT_BY_ID.get(id);
      const booked = bookedSeats.has(id);
      const selected = selectedSeats.has(id);
      button.classList.toggle("is-booked", booked);
      button.classList.toggle("is-selected", selected && !booked);
      button.disabled = booked;
      button.textContent = booked ? "✓" : String(seat.number);
      button.setAttribute(
        "aria-label",
        `${seat.zoneName} แถว ${seat.row} ที่นั่ง ${seat.number} ${booked ? "จองแล้ว" : "ว่าง"}`
      );
    });
  }

  /** ตารางราคาต่อโซน แสดงในหน้าเว็บ (ดึงจาก PRICES/ZONE_META ใน config.js โดยตรง) */
  function renderPriceLegend(container) {
    container.replaceChildren();
    Object.entries(ZONE_META).forEach(([type, meta]) => {
      const card = document.createElement("div");
      card.className = `price-card ${meta.className}`;
      card.innerHTML = `
        <div class="zone-name"><span class="zone-dot" aria-hidden="true"></span>${meta.label}</div>
        <div class="zone-price">${new Intl.NumberFormat("th-TH").format(PRICES[type])} บาท</div>`;
      container.appendChild(card);
    });
  }

  return { render, updateStates, renderPriceLegend };
})();
