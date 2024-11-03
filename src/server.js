class Server { 
  /**@type {Set<Client>} */
  static clients = new Set();
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
}

module.exports = {
  Server
}