const {Server} = require("./server");
const utils = require("./utils");

class Client {
  /**
   *
   * @param {WebSocket} ws
   * @param {string} ip
   * @param {number} lastPing
   */
  constructor(ws, ip, lastPing)  {
    this.ws = ws;
    this.ip = ip;
    this.lastPing = lastPing;

    ws.on('message', (msg) => {
      this.processMsg(msg)
    });
    ws.on('close', () => {
      utils.log("Connection closed");
      Server.deleteByWs(ws);
    })
  }

  processMsg(msg) {
    const text = Buffer.isBuffer(msg) ? msg.toString("utf8") : String(msg);
    if (text === "ping") {
      this.lastPing = Date.now();
    }
    else {
      utils.log(`@Received: ${text}`);
      Server.onDeviceMessage(this.ip, text);
    }
  }
}


module.exports.Client = Client;
