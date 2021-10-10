const Log = require('./atajo.log');
const Insights = require('./atajo.insights');

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const io = require('socket.io-client');
const Queue = require('./atajo.queue');

class Fork {

    constructor(Lambda) {

        this.internalLatency = {
            instanceStart: new Date().getTime(),
            executionTime: 0
        }

        this.interface = Lambda;
        this.hasConfigured = false;

        process.on('message', message => {
            switch (message.action) {
                case 'init':
                    this.init(message);
                    break;
            }
        });

    }

    setInactive() {
        clearTimeout(this.killTimeout);
        this.killTimeout = setTimeout(() => {
            this
                .queue
                .publish("LAMBDA:KILL", JSON.stringify({domain: domain, name: name}));
        }, global.inactiveTimeout);
    }

    respond(data) {
        data.domain = domain;
        data.name = name;
        this
            .queue
            .publish("LAMBDA:RESULT", JSON.stringify(data));
    }

    async init(message) {

        this.internalLatency.configureStart = new Date().getTime();
        this.port = message.port;
        this.release = message.release;

        global.log = new Log(this.release);

        this.config = {};

        try {
            this.config = require(path.join(process.cwd(), 'lambdas', 'config.json'));
        } catch (e) {
            try {
                this.config = require(path.join(process.cwd(), 'config', 'config.json'));
            } catch (e) {
                this.config = {}
            }
        }

        if (!this.config['CACHE']) {
            this.config['CACHE'] = {
                path: path.join(process.cwd(), 'cache')
            }
        }

        if (!this.config['MONGO']) {
            this.config['MONGO'] = {
                host: 'mongodb://localhost/lambda-' + message.domain,
                discriminate: false
            }
        }

        if (!this.config['TIMEOUTS']) {
            this.config['TIMEOUTS'] = {
                inactiveTimeout: 300000
            }
        }

        this.config.IDENTITY = message.identity;
        this.telemetry = this.startInsights(message.identity);

        this
            .telemetry
            .trackEvent({
                name: "lambda."+message.name+".fork.init",
                properties: {
                    domain: message.domain,
                    sourceDomain: message.sourceDomain,
                    lambda: message.name
                }
            });

        global.inactiveTimeout = this.config['TIMEOUTS'].inactiveTimeout;

        this.cachePath = {
            cache: path.join(this.config['CACHE']['path']),
            rx: path.join(this.config['CACHE']['path'], 'rx'),
            tx: path.join(this.config['CACHE']['path'], 'tx')
        }

        this.config.domain = global.domain;
        this.config.cache = {
            path: this.cachePath.cache,
            get: function (subPath) {
                const currPath = path.join(this.path, subPath);
                if (!fs.existsSync(currPath)) 
                    mkdirp.sync(currPath);
                return currPath
            }
        }

        global.domain = message.domain;
        global.name = message.name;
        global.sourceDomain = message.sourceDomain;
        global.secret = message.secret;
        global.config = require('../../config');

        this.setErrorHandlers();

        let API = require('./atajo.api');
        this.api = new API(domain, secret);

        var DBI = require('./dbi');

        try {
            global.dbi = await new DBI(this.config.MONGO).start();
            this.hasConfigured = true;
            this.internalLatency.configureEnd = new Date().getTime();
            this.connect(message);
        } catch (error) {
            log.error("COULD NOT INIT MONGO : ", error);
            global.dbi = false;
            this.hasConfigured = true;
            this.internalLatency.configureEnd = new Date().getTime();
            this.connect(message);
        }

        this.setInactive();
    }

    async connect(config) {

        const queue = new Queue();
        this.queue = await queue.createClient();

        this
            .queue
            .subscribe("tx:" + config.domain + ":" + config.name);

        this
            .queue
            .on('message', (topic, message) => {

                message = JSON.parse(message.toString());
                if (topic.indexOf('tx') > -1) {
                    log.debug("LAMBDA:" + domain + " - TRANSACTION RECEIVED FROM QUEUE");
                    this.tx(message);
                    this.setInactive();
                }
            })

        this
            .queue
            .publish("LAMBDA:READY", JSON.stringify({domain: config.domain, name: config.name}));
    }

    tx(transaction) {

        if (!transaction || !transaction.pid) 
            return log.warn("INVALID LAMBDA REQUEST -> DROPPING : ", transaction);
        
        // transaction.internalLatency = transaction.internalLatency || {};
        // transaction.internalLatency.execStart = new Date().getTime(); log.debug("RAW
        // TRANSACTION IS ", transaction);

        transaction.request = transaction.request || {};

        if (transaction.request) {

            if (typeof transaction.request === 'string') {
                let tempString = transaction.request + "";
                transaction.request = {
                    data: tempString
                }
            }

            transaction.request.resolve = (response) => {
                this.resolve(response, false, transaction.pid);
            };

            transaction.request.reject = (error) => {
                this.resolve(error, true, transaction.pid);
            };
        }

        transaction.environment = transaction.environment || global.release;
        try {

            transaction.request.environment = transaction.environment
            transaction.request.domain = transaction.domain;
            transaction.request.pid = transaction.pid;

            try {
                let lambda = new this.interface(this.api, this.config, log, dbi);
                lambda.request(transaction.request);
            } catch (e) {
                log.error("LAMBDA ERROR : ", e.stack);
                this.resolve(e.stack, true, transaction.pid, true);
            }

        } catch (e) {
            this.resolve(e.stack, true, transaction.pid);
        }
    }

    resolve(response, error, pid) {

        log.debug("GOT RESULT (ERROR : " + error + ") - " + pid + " --> "); //, response);

        response = response || {};
        this.respond({
            error: error
                ? 1
                : 0,
            pid: pid,
            response: response
        });

    }

    setErrorHandlers() {
        log.debug("CREATING ERROR HANDLERS");
        process.on('uncaughtException', (err) => {
            log.error(err);
            process.send({error: 1, type: 'uncaughtException', message: err})
        })

        process.on('TypeError', (err) => {
            log.error(err);
            process.send({error: 1, type: 'TypeError', message: err})
        })
    }

    startInsights(identity) {
        if (identity.insights && identity.insights.enabled && identity.insights.key) {
            return new Insights(identity.domain, identity.insights.key)
        } else {
            return new Insights(identity.domain, require('../../config').INSIGHTS.key)
        }
    }
}

exports.bind = (Lambda) => {
    let fork = new Fork(Lambda);
}