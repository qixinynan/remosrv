const state = {
  stats: {onlineDevices: 0, devices: []},
  shortcuts: [],
  activity: [],
  editingShortcutId: null,
};

const els = {
  onlineCount: document.getElementById("onlineCount"),
  deviceList: document.getElementById("deviceList"),
  commandForm: document.getElementById("commandForm"),
  commandInput: document.getElementById("commandInput"),
  logs: document.getElementById("logs"),
  clearLogs: document.getElementById("clearLogs"),
  shortcutForm: document.getElementById("shortcutForm"),
  shortcutName: document.getElementById("shortcutName"),
  shortcutCommand: document.getElementById("shortcutCommand"),
  shortcutSubmit: document.getElementById("shortcutSubmit"),
  shortcutCancel: document.getElementById("shortcutCancel"),
  shortcutList: document.getElementById("shortcutList"),
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

function renderStats() {
  els.onlineCount.textContent = String(state.stats.onlineDevices || 0);
  const devices = state.stats.devices || [];
  if (!devices.length) {
    els.deviceList.innerHTML = '<li class="device-item"><small>No device connected</small></li>';
    return;
  }
  els.deviceList.innerHTML = devices
    .map((item) => {
      return `<li class="device-item"><div>${escapeHtml(item.ip)}</div><small>Last ping: ${escapeHtml(fmtTime(item.lastPing))}</small></li>`;
    })
    .join("");
}

function lineType(type) {
  if (type === "command") return "command";
  if (type && type.includes("error")) return "error";
  return "default";
}

function renderActivity() {
  if (!state.activity.length) {
    els.logs.innerHTML = '<div class="log-line"><span class="log-time">-</span> Waiting for activity...</div>';
    return;
  }
  els.logs.innerHTML = state.activity
    .map((entry) => {
      const type = escapeHtml(entry.type || "event");
      const payload = escapeHtml(JSON.stringify(entry.payload));
      return `<div class="log-line"><span class="log-time">[${escapeHtml(fmtTime(entry.at))}]</span> <span class="log-type ${lineType(entry.type)}">${type}</span> ${payload}</div>`;
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

async function sendCommand(command) {
  const res = await fetch("/api/commands", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({command}),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.message || "Failed to send command");
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
        return;
      }
      if (data.type === "stats") {
        state.stats = data.payload || state.stats;
        renderStats();
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
  const command = els.commandInput.value.trim();
  if (!command) return;
  try {
    await sendCommand(command);
    els.commandInput.value = "";
  } catch (err) {
    addLocalLog("command-error", {message: String(err)});
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
      addLocalLog("shortcut-error", {message: String(err)});
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

loadOverview();
loadShortcuts();
renderStats();
renderActivity();
renderShortcuts();
connectAdminWs();
