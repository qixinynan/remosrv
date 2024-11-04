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
    if (msg === "ping") {
      this.lastPing = Date.now();
    }
    else {
      utils.log(`@Received: ${msg}`);
    }
  }
}


module.exports.Client = Client;