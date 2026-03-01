(function () {
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function fmtTime(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
  }

  async function api(path, options) {
    const res = await fetch(path, options);
    let data = null;
    try {
      data = await res.json();
    } catch (err) {
      data = null;
    }
    if (res.status === 401) {
      window.location.href = "/login";
      throw new Error("unauthorized");
    }
    return {res, data};
  }

  function normalizeWindowsPath(pathValue) {
    const raw = String(pathValue == null ? "" : pathValue).trim();
    if (!raw) return "C:\\";
    return raw.replace(/\//g, "\\");
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
    const clean = normalizeWindowsPath(base).replace(/\\+$/, "");
    if (/^[A-Za-z]:$/.test(clean)) {
      return `${clean}\\${name}`;
    }
    return `${clean}\\${name}`;
  }

  function readableSize(size) {
    const n = Number(size);
    if (!Number.isFinite(n) || n < 0) return "-";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  function formatActivity(entry) {
    const p = entry && entry.payload ? entry.payload : {};
    if (entry.type === "command") {
      const target = p.ip ? ` [${p.ip}]` : "";
      const result = p.result && p.result.message ? ` -> ${p.result.message}` : "";
      return `Send${target}: ${p.command || ""}${result}`;
    }
    if (entry.type === "device-message") {
      return `Device [${p.ip || "unknown"}]:\n${p.message || ""}`;
    }
    if (entry.type === "system" || entry.type === "system-error") {
      return p.message || "";
    }
    return JSON.stringify(p, null, 2);
  }

  function renderActivityLogs(container, activityList) {
    if (!container) return;
    if (!activityList || activityList.length === 0) {
      container.innerHTML = '<div class="log-line"><span class="log-time">-</span> Waiting for activity...</div>';
      return;
    }
    container.innerHTML = activityList
      .map((entry) => {
        const type = escapeHtml(entry.type || "event");
        const kind = type.includes("error") ? "error" : type === "command" ? "command" : "";
        const text = escapeHtml(formatActivity(entry));
        return `<div class="log-line"><span class="log-time">[${escapeHtml(fmtTime(entry.at))}]</span> <span class="log-type ${kind}">${type}</span> <span class="log-text">${text}</span></div>`;
      })
      .join("");
    container.scrollTop = container.scrollHeight;
  }

  async function doLogout() {
    await api("/auth/logout", {method: "POST"});
    window.location.href = "/login";
  }

  function connectAdminWs(onMessage, onOpen, onClose) {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${window.location.host}/admin/ws`);
    ws.onopen = () => {
      if (typeof onOpen === "function") onOpen();
    };
    ws.onclose = () => {
      if (typeof onClose === "function") onClose();
      setTimeout(() => connectAdminWs(onMessage, onOpen, onClose), 1500);
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (typeof onMessage === "function") onMessage(data);
      } catch (err) {
        if (typeof onMessage === "function") {
          onMessage({type: "system-error", payload: {message: String(err)}});
        }
      }
    };
    return ws;
  }

  window.RemoCommon = {
    escapeHtml,
    fmtTime,
    api,
    normalizeWindowsPath,
    parentWindowsPath,
    joinWindowsPath,
    readableSize,
    renderActivityLogs,
    doLogout,
    connectAdminWs,
  };
})();
