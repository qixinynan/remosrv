
function log(msg) {
    console.log(`[${(new Date()).toISOString()}] ${msg} `);
    process.stdout.write("> ");
}

module.exports = { log };
