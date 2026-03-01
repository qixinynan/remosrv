const C = window.RemoCommon;

const state = {
  stats: {onlineDevices: 0, devices: []},
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
  fileMeta: document.getElementById("fileMeta"),
  fileList: document.getElementById("fileList"),
  logoutBtn: document.getElementById("logoutBtn"),
};

function ensureSelectedDevice() {
  const devices = state.stats.devices || [];
  const exists = devices.some((item) => item.ip === state.file.ip);
  if (!exists) {
    state.file.ip = devices.length ? devices[0].ip : "";
  }
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
      const sizeBtn = '<button type="button" class="ghost" data-action="size">大小</button>';
      return `<li class="file-row" data-name="${C.escapeHtml(item.name)}" data-kind="${C.escapeHtml(item.kind)}" data-size="${Number.isFinite(item.size) ? item.size : ""}">
        <span class="file-name">${item.kind === "dir" ? "[DIR]" : "[FILE]"} ${C.escapeHtml(item.name)}</span>
        <span>${typeText}</span>
        <span>${sizeText}</span>
        <span class="file-actions">${enterBtn}${sizeBtn}</span>
      </li>`;
    })
    .join("");
}

async function loadOverview() {
  const {res, data} = await C.api("/api/overview");
  if (!res.ok) return;
  state.stats = data;
  renderDeviceSelect();
  renderFileRows();
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

els.fileList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const action = target.dataset.action;
  if (!action) return;

  const row = target.closest("li[data-name][data-kind]");
  if (!row) return;

  const name = row.dataset.name || "";
  const kind = row.dataset.kind || "";

  if (action === "enter" && kind === "dir") {
    const next = C.joinWindowsPath(state.file.path, name);
    state.file.path = next;
    loadFiles(next);
    return;
  }

  if (action === "size") {
    const size = row.dataset.size;
    if (!size) {
      window.alert(`${name}\n目录不显示文件大小`);
      return;
    }
    window.alert(`${name}\n大小: ${C.readableSize(Number(size))} (${size} B)`);
  }
});

els.logoutBtn.addEventListener("click", () => {
  C.doLogout();
});

C.connectAdminWs((packet) => {
  if (packet.type === "init") {
    state.stats = packet.payload.stats || state.stats;
    renderDeviceSelect();
    renderFileRows();
    return;
  }
  if (packet.type === "stats") {
    state.stats = packet.payload || state.stats;
    renderDeviceSelect();
    renderFileRows();
  }
});

loadOverview();
renderDeviceSelect();
renderFileRows();
