const C = window.RemoCommon;

const state = {
  stats: {onlineDevices: 0, devices: []},
  shortcuts: [],
  file: {
    ip: "",
    path: "C:\\",
    entries: [],
    loading: false,
  },
};

const els = {
  fileDevice: document.getElementById("fileDevice"),
  filePath: document.getElementById("filePath"),
  fileLoad: document.getElementById("fileLoad"),
  fileUp: document.getElementById("fileUp"),
  fileUrlDownload: document.getElementById("fileUrlDownload"),
  fileMeta: document.getElementById("fileMeta"),
  fileList: document.getElementById("fileList"),

  rightOnlineCount: document.getElementById("rightOnlineCount"),
  rightDeviceList: document.getElementById("rightDeviceList"),
  rightShortcutList: document.getElementById("rightShortcutList"),

  logoutBtn: document.getElementById("logoutBtn"),
};

function ensureSelectedDevice() {
  const devices = state.stats.devices || [];
  const exists = devices.some((item) => item.ip === state.file.ip);
  if (!exists) state.file.ip = devices.length ? devices[0].ip : "";
}

function renderRightStats() {
  const devices = state.stats.devices || [];
  els.rightOnlineCount.textContent = String(state.stats.onlineDevices || 0);

  if (!devices.length) {
    els.rightDeviceList.innerHTML = '<li class="device-item"><small class="muted">暂无在线设备</small></li>';
    return;
  }

  els.rightDeviceList.innerHTML = devices
    .map((item) => `<li class="device-item"><div>${C.escapeHtml(item.ip)}</div><small class="muted">Last ping: ${C.escapeHtml(C.fmtTime(item.lastPing))}</small></li>`)
    .join("");
}

function renderRightShortcuts() {
  if (!state.shortcuts.length) {
    els.rightShortcutList.innerHTML = '<li class="shortcut-item"><small class="muted">暂无快捷命令</small></li>';
    return;
  }
  els.rightShortcutList.innerHTML = state.shortcuts
    .map((item) => `<li class="shortcut-item" data-id="${C.escapeHtml(item.id)}">
      <div class="shortcut-row"><strong>${C.escapeHtml(item.name)}</strong><button type="button" data-action="run">执行</button></div>
      <div class="shortcut-command">${C.escapeHtml(item.command)}</div>
    </li>`)
    .join("");
}

function renderDeviceSelect() {
  ensureSelectedDevice();
  const devices = state.stats.devices || [];
  if (!devices.length) {
    els.fileDevice.innerHTML = '<option value="">无在线设备</option>';
    els.fileDevice.disabled = true;
    return;
  }
  els.fileDevice.disabled = false;
  els.fileDevice.innerHTML = devices
    .map((item) => `<option value="${C.escapeHtml(item.ip)}">${C.escapeHtml(item.ip)}</option>`)
    .join("");
  els.fileDevice.value = state.file.ip;
}

function renderFileRows() {
  els.filePath.value = state.file.path;
  if (!state.file.ip) {
    els.fileMeta.textContent = "暂无在线设备";
    els.fileList.innerHTML = '<li class="file-row"><span class="muted">无数据</span><span></span><span></span><span></span></li>';
    return;
  }

  els.fileMeta.textContent = state.file.loading
    ? `Loading ${state.file.path} ...`
    : `${state.file.ip} | ${state.file.path} | ${state.file.entries.length} 项`;

  if (!state.file.entries.length) {
    els.fileList.innerHTML = '<li class="file-row"><span class="muted">目录为空或尚未加载</span><span></span><span></span><span></span></li>';
    return;
  }

  els.fileList.innerHTML = state.file.entries
    .map((item) => {
      const typeText = item.kind === "dir" ? "目录" : "文件";
      const sizeText = item.kind === "file" ? C.readableSize(item.size) : "-";
      const enterBtn = item.kind === "dir" ? '<button type="button" data-action="enter">进入</button>' : "";
      const copyBtn = '<button type="button" class="ghost" data-action="copy">复制</button>';
      const moveBtn = '<button type="button" class="ghost" data-action="move">移动</button>';
      const downloadBtn = item.kind === "file" ? '<button type="button" class="ghost" data-action="download">下载</button>' : "";
      const sizeBtn = '<button type="button" class="ghost" data-action="size">大小</button>';
      const delBtn = '<button type="button" class="ghost" data-action="delete">删除</button>';
      return `<li class="file-row" data-name="${C.escapeHtml(item.name)}" data-kind="${C.escapeHtml(item.kind)}" data-size="${Number.isFinite(item.size) ? item.size : ""}">
        <span class="file-name">${item.kind === "dir" ? "[DIR]" : "[FILE]"} ${C.escapeHtml(item.name)}</span>
        <span>${typeText}</span>
        <span>${sizeText}</span>
        <span class="file-actions">${enterBtn}${copyBtn}${moveBtn}${downloadBtn}${sizeBtn}${delBtn}</span>
      </li>`;
    })
    .join("");
}

async function sendCommand(command) {
  const {res, data} = await C.api("/api/commands", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({command}),
  });
  if (!res.ok || !data || !data.ok) {
    throw new Error((data && (data.message || (data.result && data.result.message))) || "发送失败");
  }
}

async function deleteRemote(pathValue, kind) {
  const {res, data} = await C.api("/api/files/delete", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ip: state.file.ip, path: pathValue, kind}),
  });
  if (!res.ok || !data || !data.ok) {
    throw new Error((data && data.message) || "删除失败");
  }
}

async function copyRemote(srcPath, dstPath, kind) {
  const {res, data} = await C.api("/api/files/copy", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ip: state.file.ip, srcPath, dstPath, kind}),
  });
  if (!res.ok || !data || !data.ok) {
    throw new Error((data && data.message) || "复制失败");
  }
}

async function moveRemote(srcPath, dstPath) {
  const {res, data} = await C.api("/api/files/move", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ip: state.file.ip, srcPath, dstPath}),
  });
  if (!res.ok || !data || !data.ok) {
    throw new Error((data && data.message) || "移动失败");
  }
}

function decodeBase64ToBlob(base64) {
  const binary = atob(base64);
  const chunkSize = 8192;
  const chunks = [];
  for (let i = 0; i < binary.length; i += chunkSize) {
    const slice = binary.slice(i, i + chunkSize);
    const bytes = new Uint8Array(slice.length);
    for (let j = 0; j < slice.length; j += 1) {
      bytes[j] = slice.charCodeAt(j);
    }
    chunks.push(bytes);
  }
  return new Blob(chunks, {type: "application/octet-stream"});
}

async function downloadRemote(pathValue) {
  const {res, data} = await C.api("/api/files/download", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ip: state.file.ip, path: pathValue}),
  });
  if (!res.ok || !data || !data.ok) {
    throw new Error((data && data.message) || "下载失败");
  }

  const fileName = data.fileName || "download.bin";
  const blob = decodeBase64ToBlob(data.base64 || "");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function downloadFromUrlRemote(url, savePath) {
  const {res, data} = await C.api("/api/files/download-url", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ip: state.file.ip, url, savePath}),
  });
  if (!res.ok || !data || !data.ok) {
    throw new Error((data && data.message) || "URL 下载失败");
  }
}

async function loadOverview() {
  const {res, data} = await C.api("/api/overview");
  if (!res.ok) return;
  state.stats = data;
  renderRightStats();
  renderDeviceSelect();
  renderFileRows();
}

async function loadShortcuts() {
  const {res, data} = await C.api("/api/shortcuts");
  if (!res.ok) return;
  state.shortcuts = data.items || [];
  renderRightShortcuts();
}

async function loadFiles(pathValue) {
  if (!state.file.ip) return;
  state.file.loading = true;
  state.file.path = C.normalizeWindowsPath(pathValue || state.file.path);
  renderFileRows();

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    let result;
    try {
      result = await C.api("/api/files/list", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ip: state.file.ip, path: state.file.path}),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(t);
    }

    if (!result.res.ok || !result.data || !result.data.ok) {
      throw new Error((result.data && result.data.message) || "加载失败");
    }

    state.file.path = result.data.path || state.file.path;
    state.file.entries = Array.isArray(result.data.entries) ? result.data.entries : [];
  } catch (err) {
    state.file.entries = [];
    els.fileMeta.textContent = `加载失败: ${String(err.message || err)}`;
  } finally {
    state.file.loading = false;
    renderFileRows();
  }
}

els.fileDevice.addEventListener("change", () => {
  state.file.ip = els.fileDevice.value;
  state.file.entries = [];
  renderFileRows();
});

els.fileLoad.addEventListener("click", () => {
  state.file.path = C.normalizeWindowsPath(els.filePath.value);
  loadFiles(state.file.path);
});

els.fileUp.addEventListener("click", () => {
  state.file.path = C.parentWindowsPath(els.filePath.value);
  loadFiles(state.file.path);
});

els.fileUrlDownload.addEventListener("click", async () => {
  if (!state.file.ip) {
    window.alert("请先选择在线设备");
    return;
  }
  const url = window.prompt("请输入下载 URL（http/https）", "https://");
  if (!url) return;
  const defaultSave = C.joinWindowsPath(state.file.path, "download.bin");
  const savePath = window.prompt("请输入保存路径（被控设备本地路径）", defaultSave);
  if (!savePath) return;
  try {
    await downloadFromUrlRemote(url.trim(), C.normalizeWindowsPath(savePath));
    window.alert("已下发下载命令到被控设备");
  } catch (err) {
    window.alert(`URL 下载失败: ${String(err.message || err)}`);
  }
});

els.fileList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const action = target.dataset.action;
  if (!action) return;

  const row = target.closest("li[data-name][data-kind]");
  if (!row) return;

  const name = row.dataset.name || "";
  const kind = row.dataset.kind || "";
  const fullPath = C.joinWindowsPath(state.file.path, name);

  if (action === "enter" && kind === "dir") {
    state.file.path = fullPath;
    loadFiles(fullPath);
    return;
  }

  if (action === "size") {
    const size = row.dataset.size;
    if (!size) {
      window.alert(`${name}\n目录不显示文件大小`);
      return;
    }
    window.alert(`${name}\n大小: ${C.readableSize(Number(size))} (${size} B)`);
    return;
  }

  if (action === "copy") {
    const defaultPath = kind === "dir"
      ? `${fullPath}_copy`
      : (() => {
          const dot = fullPath.lastIndexOf(".");
          if (dot <= fullPath.lastIndexOf("\\")) return `${fullPath}.copy`;
          return `${fullPath.slice(0, dot)}_copy${fullPath.slice(dot)}`;
        })();
    const dst = window.prompt("请输入目标路径（复制）", defaultPath);
    if (!dst) return;
    try {
      await copyRemote(fullPath, C.normalizeWindowsPath(dst), kind);
      setTimeout(() => loadFiles(state.file.path), 500);
    } catch (err) {
      window.alert(`复制失败: ${String(err.message || err)}`);
    }
    return;
  }

  if (action === "move") {
    const dst = window.prompt("请输入目标路径（移动）", fullPath);
    if (!dst) return;
    try {
      await moveRemote(fullPath, C.normalizeWindowsPath(dst));
      setTimeout(() => loadFiles(state.file.path), 500);
    } catch (err) {
      window.alert(`移动失败: ${String(err.message || err)}`);
    }
    return;
  }

  if (action === "download") {
    try {
      await downloadRemote(fullPath);
    } catch (err) {
      window.alert(`下载失败: ${String(err.message || err)}`);
    }
    return;
  }

  if (action === "delete") {
    const confirmed = window.confirm(`确认删除 ${fullPath} ?`);
    if (!confirmed) return;
    try {
      await deleteRemote(fullPath, kind);
      setTimeout(() => loadFiles(state.file.path), 500);
    } catch (err) {
      window.alert(`删除失败: ${String(err.message || err)}`);
    }
  }
});

els.rightShortcutList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.dataset.action !== "run") return;
  const li = target.closest("li[data-id]");
  if (!li) return;
  const item = state.shortcuts.find((x) => x.id === li.dataset.id);
  if (!item) return;
  try {
    await sendCommand(item.command);
  } catch (err) {
    window.alert(String(err.message || err));
  }
});

els.logoutBtn.addEventListener("click", () => C.doLogout());

C.connectAdminWs((packet) => {
  if (packet.type === "init") {
    state.stats = packet.payload.stats || state.stats;
    state.shortcuts = packet.payload.shortcuts || [];
    renderRightStats();
    renderRightShortcuts();
    renderDeviceSelect();
    renderFileRows();
    return;
  }
  if (packet.type === "stats") {
    state.stats = packet.payload || state.stats;
    renderRightStats();
    renderDeviceSelect();
    renderFileRows();
    return;
  }
  if (packet.type === "shortcuts") {
    state.shortcuts = packet.payload.items || [];
    renderRightShortcuts();
  }
});

loadOverview();
loadShortcuts();
renderRightStats();
renderRightShortcuts();
renderDeviceSelect();
renderFileRows();
