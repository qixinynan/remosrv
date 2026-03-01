const express = require('express');
const expressWs = require('express-ws');
const {processCommand} = require('./cmd.js')
const {Server} = require('./server.js');
const {Client} = require('./client.js')
const path = require("path");
const {
    listShortcuts,
    createShortcut,
    updateShortcut,
    deleteShortcut,
} = require("./shortcuts");
const utils = require('./utils.js')

const app = express();
app.use(express.json());
app.use(express.static(path.resolve(__dirname, "..", "public")));

expressWs(app);

app.ws('/ws', (ws, req) => {
    utils.log("New Connection")
    const clientIp = req.ip || req.socket.remoteAddress; // 获取客户端 IP 地址
    const client = new Client(ws, clientIp, Date.now());
    Server.add(client);
});

app.ws('/admin/ws', (ws) => {
    utils.log("New Admin Connection");
    Server.addAdmin(ws);
    ws.send(JSON.stringify({
        type: "init",
        payload: {
            stats: Server.getStats(),
            activity: Server.getRecentActivity(),
            shortcuts: listShortcuts(),
        }
    }));
    ws.on("close", () => {
        Server.deleteAdmin(ws);
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, "..", "public", "index.html"));
});

app.get('/status', (req, res) => {
    res.send("normal");
})

app.get('/gift', (req, res) => {
    res.send("请稍等...");
    console.log("GIFTTTTT");
})

app.get("/api/overview", (req, res) => {
    res.json(Server.getStats());
});

app.post("/api/commands", (req, res) => {
    const command = (req.body && typeof req.body.command === "string")
      ? req.body.command.trim()
      : "";
    if (!command) {
        return res.status(400).json({ok: false, message: "command is required"});
    }
    const result = processCommand(command);
    Server.recordActivity("command", {source: "web", command, result});
    Server.broadcastToAdmins("stats", Server.getStats());
    if (!result || result.ok === false) {
        return res.status(400).json({ok: false, result});
    }
    res.json({ok: true, result});
});

app.get("/api/shortcuts", (req, res) => {
    res.json({items: listShortcuts()});
});

app.post("/api/shortcuts", (req, res) => {
    const name = (req.body && typeof req.body.name === "string") ? req.body.name.trim() : "";
    const command = (req.body && typeof req.body.command === "string") ? req.body.command.trim() : "";
    if (!name || !command) {
        return res.status(400).json({ok: false, message: "name and command are required"});
    }
    const item = createShortcut(name, command);
    Server.broadcastToAdmins("shortcuts", {items: listShortcuts()});
    res.status(201).json({ok: true, item});
});

app.put("/api/shortcuts/:id", (req, res) => {
    const id = req.params.id;
    const name = (req.body && typeof req.body.name === "string") ? req.body.name.trim() : "";
    const command = (req.body && typeof req.body.command === "string") ? req.body.command.trim() : "";
    if (!name || !command) {
        return res.status(400).json({ok: false, message: "name and command are required"});
    }
    const item = updateShortcut(id, name, command);
    if (!item) {
        return res.status(404).json({ok: false, message: "shortcut not found"});
    }
    Server.broadcastToAdmins("shortcuts", {items: listShortcuts()});
    res.json({ok: true, item});
});

app.delete("/api/shortcuts/:id", (req, res) => {
    const id = req.params.id;
    const ok = deleteShortcut(id);
    if (!ok) {
        return res.status(404).json({ok: false, message: "shortcut not found"});
    }
    Server.broadcastToAdmins("shortcuts", {items: listShortcuts()});
    res.json({ok: true});
});

app.listen(5599, () => {
    console.log('Server is running on http://localhost:5599');
});

setInterval(() => {
    Server.pingAll()
}, 5000);
