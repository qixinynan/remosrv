/**
 * {
 *      version: -1,
 *      method: "mute"
 *      data: ""
 *      id: 0
 * }
 **/

class Message {
    /**
     *
     * @param {number} version
     * @param {string} method
     * @param {any} data
     * @param {number} id
     */
    constructor(version, id, method, data) {
        this.version = version;
        this.method = method;
        this.data = data;
        this.id = id;
    }

    /**
     *
     * @param {string} method
     * @param data
     * @returns {Message}
     */
    static new(method, data) {
        return new Message(1, -1, method, data);
    }
}

module.exports = {
    Message
}