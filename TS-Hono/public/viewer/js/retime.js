/* ============================================================
 * 重新配速 / 改时间：
 * 直接修改 FIT 的运动起始时间与目标配速，自动重算每个记录点的时间戳与速度，
 * 并同步会话 / 圈速 / 文件头 / 计时事件的汇总时间，最后可导出。
 * ============================================================ */
window.Retime = {
  open() {
    const st = FFV.state;
    if (!st.messages) {
      U.toast("请先打开一个 FIT 文件。", 3000);
      return;
    }
    U.$("#retime-start").value = this._currentStart();
    const pace = this._currentPace();
    U.$("#retime-pace-min").value = pace.min;
    U.$("#retime-pace-sec").value = pace.sec;

    const overlay = U.$("#retime-overlay");
    if (overlay) overlay.hidden = false;
    document.body.classList.add("modal-open");
  },

  close() {
    const overlay = U.$("#retime-overlay");
    if (overlay) overlay.hidden = true;
    document.body.classList.remove("modal-open");
  },

  /* Date -> "YYYY-MM-DDTHH:MM"（本地时区，匹配 datetime-local） */
  _localInputValue(date) {
    const p = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
  },

  /* "YYYY-MM-DDTHH:MM[:SS]" -> 本地时区 Date；失败返回 null */
  _localInputToDate(v) {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) v = v + ":00";
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  },

  /* 从会话(优先)或记录推导当前开始时间 */
  _currentStart() {
    const st = FFV.state;
    let d = null;
    if (st.sessions[0] && st.sessions[0].startTime instanceof Date) d = st.sessions[0].startTime;
    else if (st.records[0] && st.records[0].timestamp instanceof Date) d = st.records[0].timestamp;
    if (!d) d = new Date();
    return this._localInputValue(d);
  },

  /* 从会话推导当前平均配速(分/km)，拆为 分 + 秒 */
  _currentPace() {
    const s0 = FFV.state.sessions[0] || {};
    const dist = Number(s0.totalDistance);
    const time = Number(s0.totalTimerTime) || Number(s0.totalElapsedTime);
    let secPerKm = 0;
    if (dist > 0 && time > 0) secPerKm = time / (dist / 1000);
    if (!secPerKm && Number(s0.avgSpeed) > 0) secPerKm = 1000 / Number(s0.avgSpeed);
    if (!secPerKm) return { min: 5, sec: 0 };
    const sec = Math.round(secPerKm);
    return { min: Math.floor(sec / 60), sec: sec % 60 };
  },

  apply() {
    const st = FFV.state;
    if (!st.messages) return;

    const rawStart = U.$("#retime-start").value || "";
    const pm = parseFloat(U.$("#retime-pace-min").value || "0");
    const ps = parseFloat(U.$("#retime-pace-sec").value || "0");

    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(rawStart)) {
      U.toast("开始时间格式不正确。", 3000);
      return;
    }
    const secPerKm = pm * 60 + ps;
    if (!secPerKm || secPerKm <= 0) {
      U.toast("配速无效（需大于 0）。", 3000);
      return;
    }
    const startDate = this._localInputToDate(rawStart);
    if (!startDate) {
      U.toast("开始时间解析失败。", 3000);
      return;
    }

    const result = this.recompute(st.messages, startDate, secPerKm);

    /* 重算图表使用的相对时间轴（配速变化会改变每个点的相对用时） */
    st.elapsedMs = [];
    let t0 = null;
    for (const r of st.records) {
      if (r.timestamp instanceof Date) {
        if (t0 === null) t0 = r.timestamp.getTime();
        st.elapsedMs.push(r.timestamp.getTime() - t0);
      } else {
        st.elapsedMs.push(st.elapsedMs.length * 1000);
      }
    }

    st.dirty = true;
    Views.syncEditUI();
    if (result.sessions > 0 || result.laps > 0) Views.renderOverview();
    Views.refreshTables();
    const metricSel = U.$("#chart-metric");
    if (Charts._chart && metricSel && metricSel.value) Charts.render(metricSel.value, true);
    U.toast(`已按新配速重算 ${result.records} 个记录点、${result.laps} 个圈速、${result.sessions} 个会话。点击「保存 FIT」导出。`, 7000);
    this.close();
  },

  /* 核心重算：返回 { records, laps, sessions } 计数 */
  recompute(messages, startDate, secPerKm) {
    const speedMps = 1000 / secPerKm; // 米/秒
    const pick = (base) => messages[base] || messages[base + "Mesgs"] || [];
    const records = pick("record");
    const laps = pick("lap");
    const sessions = pick("session");
    const fileIds = pick("fileId");
    const events = pick("event");
    const startMs = startDate.getTime();

    /* ---- 记录点：按累计距离重算时间戳；速度/增强速度设为配速 ---- */
    const recMap = [];            // { origMs, newTs, mapped }
    let mapped = 0;
    let lastNewTs = null;
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const origMs = r.timestamp instanceof Date ? r.timestamp.getTime() : null;
      const dist = r.distance == null ? NaN : Number(r.distance);
      let newTs = null;
      if (origMs != null && Number.isFinite(dist) && dist >= 0) {
        newTs = new Date(startMs + (dist / speedMps) * 1000);
        r.timestamp = newTs;
        lastNewTs = newTs;
        mapped++;
        recMap.push({ origMs, newTs, mapped: true });
      } else {
        recMap.push({ origMs, newTs: null, mapped: false });
      }
      if ("speed" in r) r.speed = speedMps;
      if ("enhancedSpeed" in r) r.enhancedSpeed = speedMps;
    }

    /* 对缺少距离的少量记录点：按原始时间在相邻已映射点间线性插值 */
    if (mapped > 0 && mapped < records.length) {
      const anchors = recMap.filter((m) => m.mapped)
        .map((m) => ({ origMs: m.origMs, newTs: m.newTs }))
        .sort((a, b) => a.origMs - b.origMs);
      for (let i = 0; i < recMap.length; i++) {
        const m = recMap[i];
        if (m.mapped || m.origMs == null) continue;
        let lo = null, hi = null;
        for (const a of anchors) {
          if (a.origMs <= m.origMs) lo = a;
          if (a.origMs >= m.origMs && !hi) hi = a;
        }
        if (lo && hi && lo !== hi) {
          const t = (m.origMs - lo.origMs) / (hi.origMs - lo.origMs);
          const interp = new Date(lo.newTs.getTime() + (hi.newTs.getTime() - lo.newTs.getTime()) * t);
          records[i].timestamp = interp;
          m.newTs = interp;
          mapped++;
        } else if (lo) {
          records[i].timestamp = lo.newTs;
          m.newTs = lo.newTs;
          mapped++;
        } else if (hi) {
          records[i].timestamp = hi.newTs;
          m.newTs = hi.newTs;
          mapped++;
        }
      }
    }

    /* 查找：原始时间 -> 最近已映射记录的新时间戳与索引 */
    const findIdx = (origMs) => {
      if (origMs == null) return -1;
      let best = -1, bestDist = Infinity;
      for (let i = 0; i < recMap.length; i++) {
        const m = recMap[i];
        if (!m.mapped || m.origMs == null) continue;
        const d = Math.abs(m.origMs - origMs);
        if (d < bestDist) { bestDist = d; best = i; }
      }
      return best;
    };

    /* ---- 圈速：旧开始时间匹配到记录点 -> 新开始；结束为下一圈前一条记录（末圈取最后一条） ---- */
    let lapCount = 0;
    const lapsSorted = laps.slice().sort((a, b) => this._ms(a.startTime) - this._ms(b.startTime));
    const lapIdx = lapsSorted.map((l) => findIdx(this._ms(l.startTime)));
    for (let k = 0; k < lapsSorted.length; k++) {
      const l = lapsSorted[k];
      const sIdx = lapIdx[k];
      if (sIdx < 0 || !recMap[sIdx].newTs) continue;
      const startTs = recMap[sIdx].newTs;
      let endTs;
      if (k + 1 < lapsSorted.length && lapIdx[k + 1] > sIdx) {
        const eIdx = lapIdx[k + 1] - 1;
        endTs = recMap[eIdx].newTs || startTs;
      } else {
        endTs = lastNewTs || startTs;
      }
      l.startTime = startTs;
      l.timestamp = endTs;
      const durSec = Math.max(0, (this._ms(endTs) - this._ms(startTs)) / 1000);
      l.totalElapsedTime = durSec;
      l.totalTimerTime = durSec;
      if ("avgSpeed" in l) l.avgSpeed = speedMps;
      if ("maxSpeed" in l) l.maxSpeed = speedMps;
      if ("enhancedAvgSpeed" in l) l.enhancedAvgSpeed = speedMps;
      if ("enhancedMaxSpeed" in l) l.enhancedMaxSpeed = speedMps;
      lapCount++;
    }

    /* ---- 会话 ---- */
    let sessionCount = 0;
    for (const s of sessions) {
      const totalDist = Number(s.totalDistance);
      s.startTime = startDate;
      if (Number.isFinite(totalDist) && totalDist > 0) {
        const durSec = totalDist / speedMps;
        const endTs = new Date(startMs + (totalDist / speedMps) * 1000);
        s.timestamp = endTs;
        s.totalElapsedTime = durSec;
        s.totalTimerTime = durSec;
        if ("avgSpeed" in s) s.avgSpeed = speedMps;
        if ("maxSpeed" in s) s.maxSpeed = speedMps;
        if ("enhancedAvgSpeed" in s) s.enhancedAvgSpeed = speedMps;
        if ("enhancedMaxSpeed" in s) s.enhancedMaxSpeed = speedMps;
      } else if (lastNewTs) {
        s.timestamp = lastNewTs;
        const durSec = (this._ms(lastNewTs) - startMs) / 1000;
        if (durSec > 0) {
          s.totalElapsedTime = durSec;
          s.totalTimerTime = durSec;
        }
      }
      sessionCount++;
    }

    /* ---- 文件头 timeCreated ---- */
    for (const f of fileIds) {
      if ("timeCreated" in f) f.timeCreated = startDate;
    }

    /* ---- 计时事件 ---- */
    for (const ev of events) {
      if (ev.event === "timer" && ev.eventType === "start") {
        ev.timestamp = startDate;
      } else if (ev.event === "timer" && (ev.eventType === "stop" || ev.eventType === "stop_all")) {
        const s0 = sessions[0];
        const totalDist = Number(s0 && s0.totalDistance);
        ev.timestamp = (Number.isFinite(totalDist) && totalDist > 0)
          ? new Date(startMs + (totalDist / speedMps) * 1000)
          : (lastNewTs || startDate);
      }
    }

    return { records: mapped, laps: lapCount, sessions: sessionCount };
  },

  _ms(d) {
    return d instanceof Date ? d.getTime() : (d == null ? 0 : Number(d));
  },
};