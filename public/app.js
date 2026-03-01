const state = {
  stats: {onlineDevices: 0, devices: []},
  shortcuts: [],
  activity: [],
  editingShortcutId: null,
  fileBrowser: {
    ip: "",
    path: "C:\\",
    entries: [],
    loading: false,
  },
};

const els = {
  onlineCount: document.getElementById("onlineCount"),
  deviceList: document.getElementById("deviceList"),
  commandForm: document.getElementById("commandForm"),
  commandInput: document.getElementById("commandInput"),
  cmdMode: document.getElementById("cmdMode"),
  logs: document.getElementById("logs"),
  clearLogs: document.getElementById("clearLogs"),
  shortcutForm: document.getElementById("shortcutForm"),
  shortcutName: document.getElementById("shortcutName"),
  shortcutCommand: document.getElementById("shortcutCommand"),
  shortcutSubmit: document.getElementById("shortcutSubmit"),
  shortcutCancel: document.getElementById("shortcutCancel"),
  shortcutList: document.getElementById("shortcutList"),
  fileDevice: document.getElementById("fileDevice"),
  filePath: document.getElementById("filePath"),
  fileLoad: document.getElementById("fileLoad"),
  fileUp: document.getElementById("fileUp"),
  fileMeta: document.getElementById("fileMeta"),
  fileList: document.getElementById("fileList"),
};

function fmtTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeWindowsPath(pathValue) {
  const raw = String(pathValue || "").trim();
  if (!raw) return "C:\\";
  return raw.replaceAll("/", "\\");
}

function parentWindowsPath(pathValue) {
  const path = normalizeWindowsPath(pathValue).replace(/\\+$/, "");
  if (/^[A-Za-z]:$/.test(path)) {
    return `${path}\\`;
  }
  const i = path.lastIndexOf("\\");
  if (i <= 2) {
    return `${path.slice(0, 2)}\\`;
  }
  return path.slice(0, i);
}

function joinWindowsPath(base, name) {
  const cleanBase = normalizeWindowsPath(base).replace(/\\+$/, "");
  if (/^[A-Za-z]:$/.test(cleanBase)) {
    return `${cleanBase}\\${name}`;
  }
  return `${cleanBase}\\${name}`;
}

function ensureSelectedDevice() {
  const devices = state.stats.devices || [];
  const exists = devices.some((item) => item.ip === state.fileBrowser.ip);
  if (!exists) {
    state.fileBrowser.ip = devices.length ? devices[0].ip : "";
  }
}

function renderDeviceSelect() {
  ensureSelectedDevice();
  const devices = state.stats.devices || [];
  if (!devices.length) {
    els.fileDevice.innerHTML = '<option value="">No device</option>';
    els.fileDevice.disabled = true;
    return;
  }
  els.fileDevice.disabled = false;
  els.fileDevice.innerHTML = devices
    .map((item) => `<option value="${escapeHtml(item.ip)}">${escapeHtml(item.ip)}</option>`)
    .join("");
  els.fileDevice.value = state.fileBrowser.ip;
}

function renderStats() {
  els.onlineCount.textContent = String(state.stats.onlineDevices || 0);
  const devices = state.stats.devices || [];
  if (!devices.length) {
    els.deviceList.innerHTML = '<li class="device-item"><small>No device connected</small></li>';
  } else {
    els.deviceList.innerHTML = devices
      .map((item) => {
        return `<li class="device-item"><div>${escapeHtml(item.ip)}</div><small>Last ping: ${escapeHtml(fmtTime(item.lastPing))}</small></li>`;
      })
      .join("");
  }
  renderDeviceSelect();
}

function lineType(type) {
  if (type === "command") return "command";
  if (type && type.includes("error")) return "error";
  return "default";
}

function formatActivity(entry) {
  const p = entry.payload || {};
  if (entry.type === "command") {
    const command = p.command || "";
    const target = p.ip ? ` [${p.ip}]` : "";
    const resultMessage = p.result && p.result.message ? ` -> ${p.result.message}` : "";
    return `Send${target}: ${command}${resultMessage}`;
  }
  if (entry.type === "device-message") {
    return `Device [${p.ip || "unknown"}]: ${p.message || ""}`;
  }
  if (entry.type === "system" || entry.type === "system-error") {
    return p.message || "";
  }
  return JSON.stringify(entry.payload || {});
}

function renderActivity() {
  if (!state.activity.length) {
    els.logs.innerHTML = '<div class="log-line"><span class="log-time">-</span> Waiting for activity...</div>';
    return;
  }
  els.logs.innerHTML = state.activity
    .map((entry) => {
      const type = escapeHtml(entry.type || "event");
      const text = escapeHtml(formatActivity(entry));
      return `<div class="log-line"><span class="log-time">[${escapeHtml(fmtTime(entry.at))}]</span> <span class="log-type ${lineType(entry.type)}">${type}</span> ${text}</div>`;
    })
    .join("");
  els.logs.scrollTop = els.logs.scrollHeight;
}

function setEditingShortcut(item) {
  state.editingShortcutId = item ? item.id : null;
  els.shortcutSubmit.textContent = item ? "Update Shortcut" : "Save Shortcut";
  els.shortcutCancel.classList.toggle("hidden", !item);
  els.shortcutName.value = item ? item.name : "";
  els.shortcutCommand.value = item ? item.command : "";
}

function renderShortcuts() {
  if (!state.shortcuts.length) {
    els.shortcutList.innerHTML = '<li class="shortcut-item"><small>No shortcuts yet.</small></li>';
    return;
  }
  els.shortcutList.innerHTML = state.shortcuts
    .map((item) => {
      return `
        <li class="shortcut-item" data-id="${escapeHtml(item.id)}">
          <div class="shortcut-title">${escapeHtml(item.name)}</div>
          <div class="shortcut-command">${escapeHtml(item.command)}</div>
          <div class="shortcut-actions">
            <button type="button" data-action="run">Run</button>
            <button type="button" class="ghost" data-action="edit">Edit</button>
            <button type="button" class="warn" data-action="delete">Delete</button>
          </div>
        </li>`;
    })
    .join("");
}

function renderFileList() {
  els.filePath.value = state.fileBrowser.path;
  if (!state.fileBrowser.ip) {
    els.fileMeta.textContent = "No online device.";
    els.fileList.innerHTML = '<li class="file-item"><small>No data</small></li>';
    return;
  }
  if (state.fileBrowser.loading) {
    els.fileMeta.textContent = `Loading ${state.fileBrowser.path} ...`;
  } else {
    els.fileMeta.textContent = `${state.fileBrowser.ip} | ${state.fileBrowser.path} | ${state.fileBrowser.entries.length} items`;
  }
  if (!state.fileBrowser.entries.length) {
    els.fileList.innerHTML = '<li class="file-item"><small>Empty or not loaded</small></li>';
    return;
  }
  els.fileList.innerHTML = state.fileBrowser.entries
    .map((item) => {
      const icon = item.kind === "dir" ? "[DIR]" : "[FILE]";
      const action = item.kind === "dir" ? '<button type="button" data-action="enter">Enter</button>' : "";
      const size = item.kind === "file" && Number.isFinite(item.size) ? `${item.size} B` : "";
      return `<li class="file-item" data-name="${escapeHtml(item.name)}" data-kind="${escapeHtml(item.kind)}"><span class="file-name"><strong>${icon}</strong> ${escapeHtml(item.name)}</span><span>${escapeHtml(size)} ${action}</span></li>`;
    })
    .join("");
}

async function sendCommand(command) {
  const res = await fetch("/api/commands", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({command}),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    const msg = data.message || (data.result && data.result.message) || "Failed to send command";
    throw new Error(msg);
  }
}

async function loadOverview() {
  const res = await fetch("/api/overview");
  if (!res.ok) return;
  state.stats = await res.json();
  renderStats();
}

async function loadShortcuts() {
  const res = await fetch("/api/shortcuts");
  if (!res.ok) return;
  const data = await res.json();
  state.shortcuts = data.items || [];
  renderShortcuts();
}

function addLocalLog(type, payload) {
  state.activity.push({type, payload, at: new Date().toISOString()});
  if (state.activity.length > 300) state.activity.shift();
  renderActivity();
}

async function loadRemoteFiles(pathValue) {
  if (!state.fileBrowser.ip) {
    addLocalLog("system-error", {message: "No device selected for file browser"});
    return;
  }
  const nextPath = normalizeWindowsPath(pathValue || state.fileBrowser.path);
  state.fileBrowser.loading = true;
  state.fileBrowser.path = nextPath;
  renderFileList();

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    let res;
    try {
      res = await fetch("/api/files/list", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ip: state.fileBrowser.ip, path: nextPath}),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(t);
    }
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.message || "Load files failed");
    }
    state.fileBrowser.path = data.path || nextPath;
    state.fileBrowser.entries = Array.isArray(data.entries) ? data.entries : [];
  } catch (err) {
    addLocalLog("system-error", {message: `File browser: ${String(err.message || err)}`});
    state.fileBrowser.entries = [];
  } finally {
    state.fileBrowser.loading = false;
    renderFileList();
  }
}

function connectAdminWs() {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${protocol}://${window.location.host}/admin/ws`);

  ws.onopen = () => addLocalLog("system", {message: "admin websocket connected"});
  ws.onclose = () => {
    addLocalLog("system-error", {message: "admin websocket disconnected, retry in 2s"});
    setTimeout(connectAdminWs, 2000);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "init") {
        state.stats = data.payload.stats || state.stats;
        state.activity = data.payload.activity || [];
        state.shortcuts = data.payload.shortcuts || [];
        renderStats();
        renderActivity();
        renderShortcuts();
        renderFileList();
        return;
      }
      if (data.type === "stats") {
        state.stats = data.payload || state.stats;
        renderStats();
        renderFileList();
        return;
      }
      if (data.type === "activity") {
        state.activity.push(data.payload);
        if (state.activity.length > 300) state.activity.shift();
        renderActivity();
        return;
      }
      if (data.type === "shortcuts") {
        state.shortcuts = data.payload.items || [];
        renderShortcuts();
      }
    } catch (err) {
      addLocalLog("system-error", {message: String(err)});
    }
  };
}

els.commandForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const rawCommand = els.commandInput.value.trim();
  if (!rawCommand) return;
  const useCmdMode = Boolean(els.cmdMode && els.cmdMode.checked);
  const command = useCmdMode && !rawCommand.startsWith("!") && !rawCommand.startsWith("#")
    ? `#${rawCommand}`
    : rawCommand;
  try {
    await sendCommand(command);
    els.commandInput.value = "";
  } catch (err) {
    addLocalLog("command-error", {message: String(err.message || err)});
  }
});

els.clearLogs.addEventListener("click", () => {
  state.activity = [];
  renderActivity();
});

els.shortcutForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = els.shortcutName.value.trim();
  const command = els.shortcutCommand.value.trim();
  if (!name || !command) return;

  const id = state.editingShortcutId;
  const url = id ? `/api/shortcuts/${encodeURIComponent(id)}` : "/api/shortcuts";
  const method = id ? "PUT" : "POST";

  const res = await fetch(url, {
    method,
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({name, command}),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    addLocalLog("shortcut-error", {message: data.message || "Shortcut operation failed"});
    return;
  }

  setEditingShortcut(null);
  await loadShortcuts();
});

els.shortcutCancel.addEventListener("click", () => {
  setEditingShortcut(null);
});

els.shortcutList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const action = target.dataset.action;
  if (!action) return;

  const li = target.closest("li[data-id]");
  if (!li) return;
  const id = li.dataset.id;
  const item = state.shortcuts.find((x) => x.id === id);
  if (!item) return;

  if (action === "run") {
    try {
      await sendCommand(item.command);
    } catch (err) {
      addLocalLog("shortcut-error", {message: String(err.message || err)});
    }
    return;
  }

  if (action === "edit") {
    setEditingShortcut(item);
    return;
  }

  if (action === "delete") {
    const res = await fetch(`/api/shortcuts/${encodeURIComponent(item.id)}`, {method: "DELETE"});
    const data = await res.json();
    if (!res.ok || !data.ok) {
      addLocalLog("shortcut-error", {message: data.message || "Delete failed"});
      return;
    }
    if (state.editingShortcutId === item.id) {
      setEditingShortcut(null);
    }
    await loadShortcuts();
  }
});

els.fileDevice.addEventListener("change", () => {
  state.fileBrowser.ip = els.fileDevice.value;
  state.fileBrowser.entries = [];
  renderFileList();
});

els.fileLoad.addEventListener("click", () => {
  state.fileBrowser.path = normalizeWindowsPath(els.filePath.value);
  loadRemoteFiles(state.fileBrowser.path);
});

els.fileUp.addEventListener("click", () => {
  state.fileBrowser.path = parentWindowsPath(els.filePath.value);
  loadRemoteFiles(state.fileBrowser.path);
});

els.fileList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const action = target.dataset.action;
  if (action !== "enter") return;

  const row = target.closest("li[data-name][data-kind]");
  if (!row) return;
  if (row.dataset.kind !== "dir") return;

  const name = row.dataset.name;
  const nextPath = joinWindowsPath(state.fileBrowser.path, name);
  state.fileBrowser.path = nextPath;
  loadRemoteFiles(nextPath);
});

loadOverview();
loadShortcuts();
renderStats();
renderActivity();
renderShortcuts();
renderFileList();
connectAdminWs();
