window.Views = {
  _sort: {},

  init() {
    U.$("#btn-expand-all").onclick = () => this.setAll(true);
    U.$("#btn-collapse-all").onclick = () => this.setAll(false);
    U.$("#btn-export-all-csv").onclick = () => Exporters.csvAll();
    this._editBtn = U.$("#btn-edit-mode");
    if (this._editBtn) {
      this._editBtn.onclick = () => this.toggleEditMode();
    }
    const tablesCtn = U.$("#message-tables");
    if (tablesCtn) {
      tablesCtn.addEventListener("click", (e) => this._onCellClick(e));
    }
  },

  setAll(open) {
    U.$$(".mtable").forEach((el) => {
      el.classList.toggle("open", open);
      el.querySelector(".mt-toggle").textContent = open ? "收起" : "展开";
    });
  },

  renderOverview() {
    const st = FFV.state;
    this.renderCards();
    this.renderHeader();
    this.renderDevice();
    this.renderLaps();
    this.renderSessions();
    this.renderErrors();
  },

  renderCards() {
    const st = FFV.state;
    const s0 = st.sessions[0] || {};
    const laps = st.laps;
    const recs = st.records;

    const sum = (arr, key) => {
      let n = 0;
      for (const r of arr) if (r[key] != null && r[key] !== "") n += Number(r[key]);
      return n;
    };
    const avg = (arr, key) => {
      let n = 0, c = 0;
      for (const r of arr) {
        const v = Number(r[key]);
        if (Number.isFinite(v) && v > 0) { n += v; c++; }
      }
      return c ? n / c : null;
    };
    const max = (arr, key) => {
      let m = null;
      for (const r of arr) {
        const v = Number(r[key]);
        if (Number.isFinite(v) && v > 0 && (m === null || v > m)) m = v;
      }
      return m;
    };

    let duration = s0.totalTimerTime != null ? Number(s0.totalTimerTime) : (s0.totalElapsedTime != null ? Number(s0.totalElapsedTime) : null);
    let distance = s0.totalDistance != null ? Number(s0.totalDistance) : null;
    let calories = s0.totalCalories != null ? Number(s0.totalCalories) : null;
    let avgHr = s0.avgHeartRate != null ? Number(s0.avgHeartRate) : (laps.length ? avg(laps, "avgHeartRate") : null);
    let maxHr = s0.maxHeartRate != null ? Number(s0.maxHeartRate) : max(recs, "heartRate");
    let avgPower = s0.avgPower != null ? Number(s0.avgPower) : avg(recs, "power");
    let maxPower = s0.maxPower != null ? Number(s0.maxPower) : max(recs, "power");
    let avgSpeed = s0.avgSpeed != null ? Number(s0.avgSpeed) : avg(recs, "speed");
    let maxSpeed = s0.maxSpeed != null ? Number(s0.maxSpeed) : max(recs, "speed");
    const avgCad = avg(recs, "cadence");
    const avgTemp = avg(recs, "temperature");

    if (duration === null && recs.length) {
      const t0 = recs[0].timestamp, t1 = recs[recs.length - 1].timestamp;
      if (t0 instanceof Date && t1 instanceof Date) duration = (t1 - t0) / 1000;
    }
    if (distance === null && recs.length) distance = sum(recs, "distance");
    if (duration === null) duration = laps.length ? sum(laps, "totalTimerTime") || sum(laps, "totalElapsedTime") : null;

    const gain = this.elevationGainLoss(recs).gain;
    const loss = this.elevationGainLoss(recs).loss;

    const fmtSpeed = (ms) => (ms == null ? null : (ms * 3.6).toFixed(1) + " km/h");
    const pace = avgSpeed && avgSpeed > 0 ? U.fmtPace(1000 / avgSpeed) : null;

    const cards = [
      { k: "时长", v: U.fmtDuration(duration) },
      { k: "距离", v: distance != null ? (distance / 1000).toFixed(2) + " km" : "" },
      { k: "平均心率", v: avgHr != null ? Math.round(avgHr) + " bpm" : "" },
      { k: "最大心率", v: maxHr != null ? Math.round(maxHr) + " bpm" : "" },
      { k: "平均功率", v: avgPower != null ? Math.round(avgPower) + " W" : "" },
      { k: "最大功率", v: maxPower != null ? Math.round(maxPower) + " W" : "" },
      { k: "平均速度", v: fmtSpeed(avgSpeed) },
      { k: "配速", v: pace },
      { k: "平均踏频", v: avgCad != null ? Math.round(avgCad) + " rpm" : "" },
      { k: "卡路里", v: calories != null ? Math.round(calories) + " kcal" : "" },
      { k: "累计爬升", v: gain != null ? Math.round(gain) + " m" : "" },
      { k: "累计下降", v: loss != null ? Math.round(loss) + " m" : "" },
      { k: "平均温度", v: avgTemp != null ? Math.round(avgTemp) + " \u00B0C" : "" },
    ];
    U.$("#summary-cards").innerHTML = cards.map((c) => `<div class="card"><div class="k">${c.k}</div><div class="v">${c.v}</div></div>`).join("");
  },

  elevationGainLoss(recs) {
    let gain = 0, loss = 0, prev = null;
    for (const r of recs) {
      const a = Number(r.altitude);
      if (!Number.isFinite(a)) continue;
      if (prev !== null) {
        const d = a - prev;
        if (d > 0) gain += d;
        else if (d < 0) loss -= d;
      }
      prev = a;
    }
    return { gain, loss };
  },

  renderHeader() {
    const h = FFV.state.header;
    if (!h) {
      U.$("#panel-header").hidden = true;
      return;
    }
    U.$("#panel-header").hidden = false;
    const proto = `${(h.protocolVersion >> 4)}.${(h.protocolVersion & 0x0f)}`;
    const rows = [
      ["头部大小", `${h.headerSize} 字节`],
      ["协议版本", proto],
      ["配置文件版本", h.profileVersion],
      ["数据大小", `${h.dataSize} 字节`],
      ["数据 CRC", `0x${h.crc.toString(16).toUpperCase().padStart(4, "0")}`],
      ["CRC 校验", h.crcValid ? "通过" : "失败"],
      ["总大小", `${FFV.state.bytes.byteLength} 字节`],
    ];
    U.$("#panel-header").innerHTML = `<h3>文件头</h3><div class="panel-body"><div class="kv-grid">${rows.map(([k, v]) => `<div class="kv"><span class="kk">${k}</span><span class="vv">${v}</span></div>`).join("")}</div></div>`;
  },

  renderDevice() {
    const list = FFV.state.deviceInfo;
    const el = U.$("#panel-device");
    if (!list.length) { el.hidden = true; return; }
    el.hidden = false;
    const d = list[0];
    const rows = [
      ["制造商", d.manufacturer],
      ["产品", d.product],
      ["序列号", d.serialNumber],
      ["软件版本", d.softwareVersion],
      ["硬件版本", d.hardwareVersion],
      ["电池状态", d.batteryStatus],
      ["电池电压", d.batteryVoltage != null ? d.batteryVoltage + " V" : ""],
      ["时间戳", d.timestamp instanceof Date ? U.toIsoLocal(d.timestamp) : ""],
    ].filter(([, v]) => v != null && v !== "");
    el.innerHTML = `<h3>设备</h3><div class="panel-body"><div class="kv-grid">${rows.map(([k, v]) => `<div class="kv"><span class="kk">${k}</span><span class="vv">${U.escapeHtml(U.fmtValue(v))}</span></div>`).join("")}</div></div>`;
  },

  renderLaps() {
    const el = U.$("#panel-laps");
    if (!FFV.state.laps.length) { el.hidden = true; return; }
    el.hidden = false;
    const cols = ["startTime", "totalElapsedTime", "totalTimerTime", "totalDistance", "maxSpeed", "avgHeartRate", "maxHeartRate", "avgPower", "maxPower", "avgCadence", "totalCalories", "totalAscent", "totalDescent"];
    el.innerHTML = `<h3>圈数 (${FFV.state.laps.length})</h3><div class="panel-body">${this.grid(FFV.state.laps, cols)}</div>`;
  },

  renderSessions() {
    const el = U.$("#panel-sessions");
    if (!FFV.state.sessions.length) { el.hidden = true; return; }
    el.hidden = false;
    const cols = ["startTime", "sport", "subSport", "totalElapsedTime", "totalTimerTime", "totalDistance", "avgHeartRate", "maxHeartRate", "avgPower", "maxPower", "avgCadence", "totalCalories", "totalAscent", "totalDescent", "avgSpeed", "maxSpeed"];
    el.innerHTML = `<h3>会话 (${FFV.state.sessions.length})</h3><div class="panel-body">${this.grid(FFV.state.sessions, cols)}</div>`;
  },

  renderErrors() {
    const el = U.$("#panel-errors");
    const errs = FFV.state.errors;
    if (!errs.length) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `<h3>解码错误 (${errs.length})</h3><div class="panel-body" style="padding:0">${errs.map((e, i) => `<div class="err-item"><span class="err-idx">#${i + 1}</span><span>${U.escapeHtml(String(e))}</span></div>`).join("")}</div>`;
  },

  grid(rows, cols) {
    if (!rows.length) return "<p>无消息</p>";
    const headers = cols.filter((c) => rows.some((r) => r[c] !== undefined && r[c] !== null && r[c] !== ""));
    return `<table class="grid"><thead><tr>${headers.map((c) => `<th>${U.escapeHtml(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${headers.map((c) => `<td>${U.escapeHtml(U.fmtValue(r[c]))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  },

  editGrid(rows, cols, name) {
    if (!rows.length) return "<p>无消息</p>";
    const editing = FFV.state.editing === true;
    const headers = cols.filter((c) => rows.some((r) => r[c] !== undefined && r[c] !== null && r[c] !== ""));
    const nameAttr = U.escapeHtml(name);
    const body = rows.map((r) => {
      const idx = r._editIdx;
      const cells = headers.map((c) => {
        const v = r[c];
        const editable = editing
          && v !== undefined && v !== null && v !== ""
          && (typeof v === "number" || typeof v === "string" || typeof v === "boolean" || v instanceof Date);
        const attrs = editable ? ` class="edit-cell" data-name="${nameAttr}" data-field="${U.escapeHtml(c)}" data-idx="${idx}"` : "";
        return `<td${attrs}>${U.escapeHtml(U.fmtValue(v))}</td>`;
      }).join("");
      return `<tr>${cells}</tr>`;
    }).join("");
    return `<table class="grid"><thead><tr>${headers.map((c) => `<th>${U.escapeHtml(c)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`;
  },

  toggleEditMode() {
    if (!FFV.state.messages) {
      U.toast("请先打开一个 FIT 文件。", 3000);
      return;
    }
    FFV.state.editing = !FFV.state.editing;
    this.syncEditUI();
    this.refreshTables();
    U.toast(FFV.state.editing ? "编辑模式已开启：点击表格中的单元格即可修改数值。" : "编辑模式已关闭。", 3000);
  },

  syncEditUI() {
    const editBtn = U.$("#btn-edit-mode");
    if (editBtn) {
      editBtn.classList.toggle("active", FFV.state.editing === true);
      editBtn.textContent = FFV.state.editing ? "编辑中…" : "编辑";
    }
    const saveBtn = U.$("#btn-save-fit");
    if (saveBtn) saveBtn.textContent = FFV.state.dirty ? "保存 FIT *" : "保存 FIT";
  },

  _onCellClick(e) {
    if (!FFV.state.editing) return;
    const td = e.target.closest("td.edit-cell");
    if (!td) return;
    if (td.querySelector("input")) return;
    this.beginEditCell(td);
  },

  beginEditCell(td) {
    const name = td.dataset.name;
    const idx = Number(td.dataset.idx);
    const field = td.dataset.field;
    const list = FFV.state.messages && FFV.state.messages[name];
    if (!list || !list[idx]) return;
    const msg = list[idx];
    const original = msg[field];

    const input = document.createElement("input");
    input.type = "text";
    input.className = "cell-input";
    input.value = U.inputString(original);
    td.textContent = "";
    td.appendChild(input);
    input.focus();
    if (input.select) input.select();

    let done = false;
    const commit = () => {
      if (done) return;
      done = true;
      const parsed = U.parseEditedValue(original, input.value);
      const same = original instanceof Date
        ? (parsed instanceof Date && parsed.getTime() === original.getTime())
        : (parsed === original);
      if (!same) U.setMsgField(name, idx, field, parsed);
      td.textContent = U.fmtValue(msg[field]);
      this.syncEditUI();
      if (FFV.state.dirty) this.renderOverview();
    };
    const cancel = () => {
      if (done) return;
      done = true;
      td.textContent = U.fmtValue(original);
    };

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e2) => {
      if (e2.key === "Enter") { e2.preventDefault(); input.blur(); }
      else if (e2.key === "Escape") { e2.preventDefault(); cancel(); }
    });
  },

  displayName(key) {
    return key.replace(/Mesgs$/, "");
  },

  renderTables() {
    const st = FFV.state;
    const names = Object.keys(st.messages);
    const counts = names.map((n) => `${this.displayName(n)}: ${st.messages[n].length}`).join(" \u00B7 ");
    U.$("#tables-count").textContent = `${names.length} 种消息类型 \u2014 ${counts}`;
    const container = U.$("#message-tables");
    this._sort = {};

    container.innerHTML = names.map((name) => {
      const list = st.messages[name];
      const cols = [];
      for (const m of list) for (const k of Object.keys(m)) if (!cols.includes(k)) cols.push(k);
      const id = "mt-" + name.replace(/[^a-zA-Z0-9]/g, "");
      return `<div class="mtable" id="${id}">
        <div class="mtable-head" onclick="Views.toggleTable('${id}')">
          <div class="mt-title">${U.escapeHtml(this.displayName(name))}<span class="mt-count">${list.length} 条消息</span></div>
          <div class="mt-actions" onclick="event.stopPropagation()">
            <button class="btn btn-sm" onclick="Views.downloadCsv('${id}')">下载 CSV</button>
            <span class="mt-toggle">展开</span>
          </div>
        </div>
        <div class="mtable-body" data-name="${U.escapeHtml(name)}"></div>
      </div>`;
    }).join("");

    container.querySelectorAll(".mtable-body").forEach((body) => {
      const name = body.dataset.name;
      this.fillGrid(body, name, []);
    });
  },

  /* 数据被批量改写（如「调整时间/配速」）后重绘表格，保留展开状态与排序 */
  refreshTables() {
    if (!FFV.state.messages) return;
    const container = U.$("#message-tables");
    if (!container || !container.children.length) return;

    const expanded = new Set();
    U.$$(".mtable.open .mtable-body").forEach((b) => expanded.add(b.dataset.name));
    const sortSnapshot = { ...this._sort };
    const sortCol = {};
    for (const k of Object.keys(sortSnapshot)) {
      const i = k.indexOf("|");
      if (i > 0) sortCol[k.slice(0, i)] = k.slice(i + 1);
    }

    this.renderTables();
    this._sort = sortSnapshot;

    U.$$(".mtable").forEach((el) => {
      const body = el.querySelector(".mtable-body");
      if (!body) return;
      const name = body.dataset.name;
      const col = sortCol[name];
      if (col) {
        const dir = sortSnapshot[name + "|" + col];
        this.fillGrid(body, name, col);
        body.querySelectorAll("thead th").forEach((th) => {
          if (th.textContent === col) th.className = dir === "asc" ? "sorted-asc" : "sorted-desc";
        });
      }
      if (expanded.has(name)) {
        el.classList.add("open");
        const t = el.querySelector(".mt-toggle");
        if (t) t.textContent = "收起";
      }
    });
  },

  fillGrid(body, name, sortKey) {
    const list = FFV.state.messages[name];
    const cols = [];
    for (const m of list) for (const k of Object.keys(m)) if (!cols.includes(k)) cols.push(k);
    const key = `${name}`;
    let rows = list.map((m, i) => ({ ...m, _editIdx: i }));
    if (sortKey) {
      const dir = this._sort[key + "|" + sortKey];
      rows.sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        const ac = av instanceof Date ? av.getTime() : (av == null ? null : av);
        const bc = bv instanceof Date ? bv.getTime() : (bv == null ? null : bv);
        if (ac === bc) return 0;
        if (ac === null) return 1;
        if (bc === null) return -1;
        if (ac < bc) return dir === "desc" ? 1 : -1;
        return dir === "desc" ? -1 : 1;
      });
    }
    body.innerHTML = this.editGrid(rows, cols, name);
    body.querySelectorAll("thead th").forEach((th, i) => {
      th.onclick = () => {
        const col = cols[i];
        const k = `${name}|${col}`;
        const cur = this._sort[k];
        this._sort[k] = cur === "asc" ? "desc" : "asc";
        body.querySelectorAll("th").forEach((t) => t.className = "");
        th.className = this._sort[k] === "asc" ? "sorted-asc" : "sorted-desc";
        this.fillGrid(body, name, col);
      };
    });
  },

  toggleTable(id) {
    const el = U.$("#" + id);
    const open = el.classList.toggle("open");
    el.querySelector(".mt-toggle").textContent = open ? "收起" : "展开";
  },

  downloadCsv(id) {
    const el = U.$("#" + id);
    const name = el.querySelector(".mtable-body").dataset.name;
    Exporters.csv(FFV.state.messages[name], `${FFV.state.fileName.replace(/\.fit$/i, "")}_${this.displayName(name)}.csv`);
  },
};