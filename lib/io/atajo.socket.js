
const io = require('socket.io-client');
const os = require('os');
const uuidv4 = require('uuid/v4');

class Socket { 
    constructor(release, identity, secret) { 

        this.core = identity.core[release] || identity.core;  
        this.endpoint = this.core.protocol + "://" + this.core.host + ":" + this.core.port;
        this.domain = identity.domain; 

        this.config = require('../../config').SOCKET; 
        this.opts = this.config.OPTIONS; 

        this.opts.query = {
            hostname: os.hostname(),
            secret: secret,
            domain: identity.domain,
            uuid: uuidv4()
        }

        log.info("IO: CONNECTING TO CORE - "+identity.domain+" @ "+this.endpoint);
        this.socket = io.connect(this.endpoint, this.opts);
        this.socket.endpoint = this.endpoint;

        return this.socket; 
        
    }

}

module.exports = Socket; 