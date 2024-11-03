
function log(msg) {
    console.log(`${msg} `);
    process.stdout.write("> ");
}

module.exports = { log };