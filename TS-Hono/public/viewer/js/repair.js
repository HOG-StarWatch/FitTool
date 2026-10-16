window.Repair = {
  RUNNING: false,

  async run() {
    if (this.RUNNING) return;
    if (FFV.state.sourceLabel) {
      U.toast("未检测到错误", 3000);
      return;
    }
    const btn = U.$("#btn-repair");
    btn.disabled = true;
    this.RUNNING = true;
    const status = U.$("#file-status");
    const prevText = status.textContent;
    const prevCls = status.className;
    try {
      status.textContent = "正在修复\u2026";
      await new Promise((r) => setTimeout(r, 30));

      const decoder = new FitSDK.Decoder(FitSDK.Stream.fromArrayBuffer(FFV.state.bytes.buffer));
      const opts = {
        applyScaleAndOffset: true,
        expandSubFields: true,
        expandComponents: true,
        convertTypesToStrings: true,
        convertDateTimesToDates: true,
        includeUnknownData: false,
        mergeHeartRates: true,
      };
      const { messages, errors } = decoder.read(opts);

      const result = Encode.buildFit(messages);
      const outName = FFV.state.fileName.replace(/\.fit$/i, "") + "_fixed.fit";
      U.download(result.bytes, outName, "application/octet-stream");

      const skippedList = [...result.skipped].join(", ") || "无";
      U.toast(`修复文件已下载：写入 ${result.ok} 条消息，跳过 ${result.skip} 条（${skippedList}）。解码错误：${errors.length} 条。`, 7000);
    } catch (e) {
      status.className = "file-status bad";
      status.textContent = "修复失败：" + (e.message || e);
      console.error(e);
    } finally {
      btn.disabled = false;
      this.RUNNING = false;
      if (status.textContent.startsWith("正在修复")) {
        status.textContent = prevText;
        status.className = prevCls;
      }
    }
  },
};