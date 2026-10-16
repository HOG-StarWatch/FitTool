/* ============================================================
 * 共享编解码通道：把解码后的 messages（可含用户编辑）重编码为 FIT 字节。
 * repair.js 与「保存 FIT」共用此模块，保证消息名→编号映射与写入口径一致。
 * ============================================================ */
window.Encode = {
  _nameToNum: null,

  // 消息类型名 → 全局消息编号（兼容 "record" / "recordMesgs" 两种键名）
  mesgNumFor(name) {
    if (!this._nameToNum) {
      this._nameToNum = {};
      const t = FitSDK.Profile.types && FitSDK.Profile.types.mesgNum;
      if (t) for (const [num, nm] of Object.entries(t)) this._nameToNum[nm] = Number(num);
      if (FitSDK.Profile.MesgNum) {
        for (const [k, v] of Object.entries(FitSDK.Profile.MesgNum)) {
          this._nameToNum[this.snakeToCamel(k)] = v;
        }
      }
    }
    return this._nameToNum[name.replace(/Mesgs$/, "")];
  },

  snakeToCamel(s) {
    return s.toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  },

  buildFit(messages) {
    const encoder = new FitSDK.Encoder();
    let ok = 0;
    let skip = 0;
    const skipped = new Set();
    const log = [];

    const names = Object.keys(messages || {});
    for (const name of names) {
      const num = this.mesgNumFor(name);
      const list = messages[name] || [];
      for (const m of list) {
        if (!m || typeof m !== "object") continue;
        const payload = { ...m, mesgNum: num };
        try {
          encoder.writeMesg(payload);
          ok++;
        } catch (e) {
          skip++;
          skipped.add(name);
          if (log.length < 50) log.push(`${name}: ${e.message || e}`);
        }
      }
    }

    const raw = encoder.close();
    const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
    return { bytes, ok, skip, skipped, log };
  },
};
