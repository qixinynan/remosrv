const C = window.RemoCommon;

const state = {
  stats: {onlineDevices: 0, devices: []},
  shortcuts: [],
  activity: [],
  editingShortcutId: null,
  cmdHistory: [],
  cmdCursor: -1,
  cmdDraft: "",
};

const els = {
  commandForm: document.getElementById("commandForm"),
  commandInput: document.getElementById("commandInput"),
  cmdMode: document.getElementById("cmdMode"),
  logs: document.getElementById("logs"),
  clearLogs: document.getElementById("clearLogs"),
  quickStrip: document.getElementById("quickStrip"),

  rightOnlineCount: document.getElementById("rightOnlineCount"),
  rightDeviceList: document.getElementById("rightDeviceList"),
  rightShortcutList: document.getElementById("rightShortcutList"),

  shortcutForm: document.getElementById("shortcutForm"),
  shortcutName: document.getElementById("shortcutName"),
  shortcutCommand: document.getElementById("shortcutCommand"),
  shortcutSubmit: document.getElementById("shortcutSubmit"),
  shortcutCancel: document.getElementById("shortcutCancel"),

  logoutBtn: document.getElementById("logoutBtn"),
};

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

function renderShortcutLists() {
  if (!state.shortcuts.length) {
    els.quickStrip.innerHTML = "";
    els.rightShortcutList.innerHTML = '<li class="shortcut-item"><small class="muted">暂无快捷命令</small></li>';
    return;
  }

  els.quickStrip.innerHTML = state.shortcuts
    .map((item) => `<button type="button" data-id="${C.escapeHtml(item.id)}">${C.escapeHtml(item.name)}</button>`)
    .join("");

  els.rightShortcutList.innerHTML = state.shortcuts
    .map((item) => `<li class="shortcut-item" data-id="${C.escapeHtml(item.id)}">
      <div class="shortcut-row"><strong>${C.escapeHtml(item.name)}</strong>
        <span>
          <button type="button" data-action="run">执行</button>
          <button type="button" class="ghost" data-action="edit">编辑</button>
          <button type="button" class="ghost" data-action="delete">删除</button>
        </span>
      </div>
      <div class="shortcut-command">${C.escapeHtml(item.command)}</div>
    </li>`)
    .join("");
}

function renderLogs() {
  C.renderActivityLogs(els.logs, state.activity);
}

function addLocalLog(type, message) {
  state.activity.push({type, payload: {message}, at: new Date().toISOString()});
  if (state.activity.length > 500) state.activity.shift();
  renderLogs();
}

function setEditingShortcut(item) {
  state.editingShortcutId = item ? item.id : null;
  els.shortcutSubmit.textContent = item ? "更新" : "保存";
  els.shortcutCancel.classList.toggle("hidden", !item);
  els.shortcutName.value = item ? item.name : "";
  els.shortcutCommand.value = item ? item.command : "";
}

function resetHistoryCursor() {
  state.cmdCursor = -1;
  state.cmdDraft = "";
}

function pushHistory(command) {
  const text = String(command || "").trim();
  if (!text) return;
  const last = state.cmdHistory[state.cmdHistory.length - 1];
  if (last !== text) {
    state.cmdHistory.push(text);
  }
  if (state.cmdHistory.length > 200) {
    state.cmdHistory.shift();
  }
  resetHistoryCursor();
}

function browseHistory(direction) {
  if (!state.cmdHistory.length) return;
  if (state.cmdCursor === -1) {
    state.cmdDraft = els.commandInput.value;
    state.cmdCursor = state.cmdHistory.length;
  }
  const next = state.cmdCursor + direction;
  if (next < 0) {
    state.cmdCursor = 0;
  } else if (next > state.cmdHistory.length) {
    state.cmdCursor = state.cmdHistory.length;
  } else {
    state.cmdCursor = next;
  }

  if (state.cmdCursor === state.cmdHistory.length) {
    els.commandInput.value = state.cmdDraft;
  } else {
    els.commandInput.value = state.cmdHistory[state.cmdCursor] || "";
  }
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

async function loadOverview() {
  const {res, data} = await C.api("/api/overview");
  if (!res.ok) return;
  state.stats = data;
  renderRightStats();
}

async function loadShortcuts() {
  const {res, data} = await C.api("/api/shortcuts");
  if (!res.ok) return;
  state.shortcuts = data.items || [];
  renderShortcutLists();
}

els.commandForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const raw = els.commandInput.value.trim();
  if (!raw) return;

  const useCmdMode = Boolean(els.cmdMode.checked);
  const cmd = useCmdMode && !raw.startsWith("!") && !raw.startsWith("#") ? `#${raw}` : raw;

  try {
    await sendCommand(cmd);
    pushHistory(raw);
    els.commandInput.value = "";
  } catch (err) {
    addLocalLog("command-error", String(err.message || err));
  }
});

els.commandInput.addEventListener("keydown", (event) => {
  if (event.key === "ArrowUp") {
    event.preventDefault();
    browseHistory(-1);
    return;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    browseHistory(1);
  }
});

els.commandInput.addEventListener("input", () => {
  if (state.cmdCursor === -1) return;
  state.cmdDraft = els.commandInput.value;
});

els.quickStrip.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const id = target.dataset.id;
  if (!id) return;
  const item = state.shortcuts.find((x) => x.id === id);
  if (!item) return;
  try {
    await sendCommand(item.command);
  } catch (err) {
    addLocalLog("shortcut-error", String(err.message || err));
  }
});

els.shortcutForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = els.shortcutName.value.trim();
  const command = els.shortcutCommand.value.trim();
  if (!name || !command) return;

  const id = state.editingShortcutId;
  const path = id ? `/api/shortcuts/${encodeURIComponent(id)}` : "/api/shortcuts";
  const method = id ? "PUT" : "POST";
  const {res, data} = await C.api(path, {
    method,
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({name, command}),
  });

  if (!res.ok || !data || !data.ok) {
    addLocalLog("shortcut-error", (data && data.message) || "快捷命令操作失败");
    return;
  }

  setEditingShortcut(null);
  await loadShortcuts();
});

els.shortcutCancel.addEventListener("click", () => setEditingShortcut(null));

els.rightShortcutList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const action = target.dataset.action;
  if (!action) return;

  const li = target.closest("li[data-id]");
  if (!li) return;
  const item = state.shortcuts.find((x) => x.id === li.dataset.id);
  if (!item) return;

  if (action === "run") {
    try {
      await sendCommand(item.command);
    } catch (err) {
      addLocalLog("shortcut-error", String(err.message || err));
    }
    return;
  }

  if (action === "edit") {
    setEditingShortcut(item);
    return;
  }

  if (action === "delete") {
    const {res, data} = await C.api(`/api/shortcuts/${encodeURIComponent(item.id)}`, {method: "DELETE"});
    if (!res.ok || !data || !data.ok) {
      addLocalLog("shortcut-error", (data && data.message) || "删除失败");
      return;
    }
    if (state.editingShortcutId === item.id) setEditingShortcut(null);
    await loadShortcuts();
  }
});

els.clearLogs.addEventListener("click", () => {
  state.activity = [];
  renderLogs();
});

els.logoutBtn.addEventListener("click", () => C.doLogout());

C.connectAdminWs(
  (packet) => {
    if (packet.type === "init") {
      state.stats = packet.payload.stats || state.stats;
      state.shortcuts = packet.payload.shortcuts || state.shortcuts;
      state.activity = packet.payload.activity || [];
      renderRightStats();
      renderShortcutLists();
      renderLogs();
      return;
    }
    if (packet.type === "stats") {
      state.stats = packet.payload || state.stats;
      renderRightStats();
      return;
    }
    if (packet.type === "shortcuts") {
      state.shortcuts = packet.payload.items || [];
      renderShortcutLists();
      return;
    }
    if (packet.type === "activity") {
      state.activity.push(packet.payload);
      if (state.activity.length > 500) state.activity.shift();
      renderLogs();
      return;
    }
    if (packet.type === "system-error") {
      addLocalLog("system-error", packet.payload && packet.payload.message ? packet.payload.message : "未知错误");
    }
  },
  () => addLocalLog("system", "admin websocket connected"),
  () => addLocalLog("system-error", "admin websocket disconnected, retrying")
);

loadOverview();
loadShortcuts();
renderRightStats();
renderShortcutLists();
renderLogs();
