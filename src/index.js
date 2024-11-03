const express = require('express');
const expressWs = require('express-ws');
const readline = require("readline")
const {processCommand} = require('./cmd.js')
const {Server} = require('./server.js');
const {Client} = require('./client.js')
const utils = require('./utils.js')

const app = express();
app.set("view engine", "ejs");

expressWs(app);

app.ws('/ws', (ws, req) => {
    utils.log("New Connection")
    const clientIp = req.ip || req.socket.remoteAddress; // 获取客户端 IP 地址
    const client = new Client(ws, clientIp);
    Server.add(client);
    
});

app.get('/', (req, res) => {
    res.render('index', { title: 'Express EJS', message: 'Hello, EJS!' });
});


app.listen(5599, () => {
    console.log('WebSocket server is running on ws://localhost:5599/ws');
    getCommand();
});

const r = readline.createInterface({input: process.stdin, output: process.stdout});

function getCommand () {
  r.question("> ", (msg) => {
    if(msg.trim().length > 0) {
        processCommand(msg);
    }
    getCommand();
  })
}

