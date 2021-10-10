const Log = require('./atajo.log');
const Insights = require('./atajo.insights');
const Queue = require('./atajo.queue');
const Socket = require('./atajo.socket');
const Listener = require('./atajo.listener');
const Rest = require('./atajo.rest'); 

const path = require('path');
const fs = require('fs');
const uuidv4 = require('uuid/v4');

global.config = require('../../config');
global.log = null;
global.environment = null;

class IO {

    constructor(domain, secret, id) {

        this.consul = require('./atajo.consul')
            .fetch(domain)
            .then(identity => {
                this.identity = identity;

                this.domain = domain;
                this.secret = secret;
                this.release = identity.release || 'dev';
                this.config = require(path.join(process.cwd(), 'config', 'config.json')) || {};

                global.log = new Log(this.release);

                this.insights = this.startInsights(identity);
                this.insights.trackEvent({name: "lambda:start"});

                this
                    .startQueue(identity)
                    .then(queue => {
                        this.queue = queue;
                        this.socket = this.startConnection(identity, secret);
                        this.listener = this.startListener();
                        this.uploadDefinition(); 
                    })

                // console.log("IDENTITY IS : ", this.identity); console.log("RELEASE IS : ",
                // this.release); console.log("CONFIG IS : ", this.config);

            })
            .catch(e => {
                console.error("IO ERROR : ", e);
                process.exit(1);
            })

    }

    uploadDefinition() { 

        const rest = new Rest(this.domain); 
        rest.publishDefinition(); 


    }

    startInsights(identity) {
        if (identity.insights && identity.insights.enabled && identity.insights.key) {
            return new Insights(identity.domain, identity.insights.key)
        } else {
            return new Insights(identity.domain, require('../../config').INSIGHTS.key)
        }
    }

    async startQueue(identity) {
        const queue = new Queue(identity); 
        await queue.createServer(); 
        return await queue.createClient();
    }

    startConnection(identity, secret) {
        return new Socket(identity.release || 'dev', identity, secret)
    }

    startListener() {

        const setup = {
            domain: this.domain,
            secret: this.secret,
            identity: this.identity,
            release: this.release, 
            telemetry: this.insights,
            config: this.config,
            queue: this.queue
        }

        const listener = new Listener(setup);

        listener.add(this.socket, (event, data) => {
            if (event == 'disconnect') {
                log.warn('IO: CORE DISCONNECTED - RETRYING IN 5 SECONDS');
                setTimeout(() => {
                    this
                        .socket
                        .open();
                }, 5000);
            }

            if (event == 'connect') {
                log.info('IO: CONNECTED TO CORE');
            }
        });

        return listener;
    }
}

module.exports = IO;