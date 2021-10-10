const mosca = require('mosca');
const mqtt = require('mqtt');

class Queue {
    constructor(identity) {
        this.config = require('../../config').QUEUE;
        this.port = this.config.port;
    }

    createServer() {
    return new Promise((resolve, reject) => {

        this.server = new mosca.Server({port: this.port});

        this
            .server
            .on('ready', () => {
                log.info("QUEUE: READY ON PORT ", this.config.port);
                resolve(); 
            });
        }); 
    }

    createClient() {
        return new Promise((resolve, reject) => {

            this.client = mqtt.connect('mqtt://localhost:' + this.config.port);
            this
                .client
                .on('connect', () => {
                    resolve(this.client);
                });

        })

    }

}

module.exports = Queue;