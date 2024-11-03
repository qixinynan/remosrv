const {Server} = require("./server");
const utils = require("./utils");

class Client {
  /**
   *
   * @param {WebSocket} ws
   * @param {string} ip
   */
  constructor(ws, ip)  {
    this.ws = ws;
    this.ip = ip;

    ws.on('message', (msg) => {
        utils.log(`@Received: ${msg}`);
    });
    ws.on('close', () => {
      utils.log("Connection closed");
      Server.deleteByWs(ws);
    })
  }  
}


module.exports.Client = Client;