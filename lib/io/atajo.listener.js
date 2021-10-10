const path = require('path');
const fs = require('fs');
const Device = require('./atajo.device');
const request = require('request');
const utils = require('./atajo.utils');
const Lambda = require('./atajo.lambda');
const pako = require('pako');

class Listener {

    constructor(setup) {

        Object
            .keys(setup)
            .forEach(key => {
                log.debug("LISTENER: CONFIGURING " + key);
                this[key] = setup[key];
            })

        this.lambda = new Lambda(setup);
        this.responseQueue = [];
        this.lambdaBusy = false;

        this.configureCache();

    }

    configureCache() {

        this.config['CACHE'] = this.config['CACHE'] || {
            path: path.join(process.cwd(), 'cache')
        }

        this.cache = {};
        this.cachePath = path.join(this.config['CACHE'].path);
        log.debug("LISTENER: INITIALIZING LAMBDA CACHE PATH - " + this.cachePath);
        fs.exists(this.cachePath, (exists) => {
            if (!exists) {
                fs.mkdirSync(this.cachePath);
            }
        });

    }

    add(socket, event) {

        this.socket = socket;

        //EVT
        log.debug("LISTENER: ADDING DISCONNECT LISTENER");
        socket.on('disconnect', data => {
            event('disconnect', data);
            this
                .telemetry
                .trackEvent({
                    name: "lambda.controller.disconnect",
                    properties: {
                        host: socket.endpoint,
                        domain: this.domain
                    }
                });
        });

        log.debug("LISTENER: ADDING CONNECT LISTENER");
        socket.on('connect', data => {
            event('connect', data);
            this
                .telemetry
                .trackEvent({
                    name: "lambda.controller.connect",
                    properties: {
                        host: socket.endpoint,
                        domain: this.domain
                    }
                });
        });

        log.debug("LISTENER: ADDING CONNECT ERROR LISTENER");
        socket.on('connect_error', (error) => {
            this
                .telemetry
                .trackEvent({
                    name: "lambda.controller.connect.error",
                    properties: {
                        error: error,
                        domain: this.domain
                    }
                });
            event('disconnect', error);
        });

        log.debug("LISTENER: ADDING CONNECT TIMEOUT LISTENER");
        socket.on('connect_timeout', (error) => {
            log.debug('CONNECT TIMEOUT');
            event('disconnect', error);
        });

        log.debug("LISTENER: ADDING CORE MESSAGE LISTENER");
        socket.on('core:message', message => {
            if (message.message) {
                console.info("CORE MESSAGE : ", message.message);
            }
            if (message.disconnect) {
                socket.disconnect();
            }
        });

        log.debug("LISTENER: ADDING CLIENT CONNECT LISTENER");
        socket.on('client:connect', evt => {
            //this.lambdaEvent('client:connect', evt);
            let trackingObj = {
                ip: evt.ip,
                domain: this.domain
            }

            if (evt.device) {
                for (let i in evt.device) {
                    trackingObj[i] = evt.device[i];
                }
            }

            this
                .telemetry
                .trackEvent({name: "lambda.controller.client.connect", properties: trackingObj});
            log.debug("CLIENT:CONNECT", evt);
        });

        log.debug("LISTENER: ADDING CLIENT DISCONNECT LISTENER");
        socket.on('client:disconnect', evt => {
            //this.lambdaEvent('client:disconnect', evt);
            let trackingObj = {
                ip: evt.ip,
                domain: this.domain
            }

            if (evt.device) {
                for (let i in evt.device) {
                    trackingObj[i] = evt.device[i];
                }
            }

            this
                .telemetry
                .trackEvent({name: "lambda.controller.client.disconnect", properties: trackingObj});
            log.debug("CLIENT:DISCONNECT", evt);
        });

        //API
        log.debug("LISTENER: ADDING API TX LISTENER");
        socket.on('api:tx', tx => {
            tx = this.processLatency(tx, 'tx');
            this.lambdaTx(tx, 'api:tx');
        });

        //ATL
        log.debug("LISTENER: ADDING CLIENT TX LISTENER");
        socket.on('client:tx', tx => {
            this.lambdaTx(tx, 'client:tx');
        });

        log.debug("LISTENER: ADDING LAMBDA TX LISTENER");
        socket.on('lambda:tx', tx => {
            tx = this.processLatency(tx, 'tx');
            this.lambdaTx(tx, 'lambda:tx');
        });

        log.debug("LISTENER: ADDING LAMBDA RX LISTENER");
        socket.on('lambda:rx', rx => {
            log.debug("LAMBDA:RX : ", rx);

            rx = this.verifyTransaction(rx);
            if (!rx) {
                log.error("LISTENER:LAMBDA:RX RESPONSE (NO PID)", rx);
                return;
            }

            if (this.transactions[rx.pid]) {
                let caller = this.transactions[rx.pid];
                log.debug("LAMBDA:RX  IS : ", rx);
                log.debug("LAMBDA:RX LAMBDA IS : " + caller.name);

                this
                    .cache[caller.domain][caller.name]
                    .process
                    .send({action: 'rx', request: rx});

            } else {
                log.error("LISTENER:LAMBDA:RX INVALID PID - DROPPING ", rx);
                return;
            }

        });

    }

    lambdaTx(tx, namespace) {

        tx = this.verifyTransaction(tx);
        if (!tx) 
            return log.error("LISTENER:" + namespace.toUpperCase() + " INVALID REQUEST", tx);
        
        tx.namespace = namespace;

        //PROCESS CREDENTIALS IF THERE -
        let safeCredentials = {};
        if (tx.credentials) {
            safeCredentials = Object.create({}, tx.credentials);
            delete safeCredentials.password;
        }

        this
            .telemetry
            .trackEvent({
                name: "lambda:request:queued",
                properties: {
                    username: safeCredentials.username,
                    namespace: namespace,
                    domain: this.domain,
                    lambda: tx.lambda
                }
            });

        tx = this.processLatency(tx, 'tx');
        this
            .lambda
            .onTx(tx)
            .then(result => {

                log.debug("TRANSACTION RESOLVED : ", result);
                this.sendResponse(0, result);

            })
            .catch(result => {

                log.warn("TRANSACTION REJECTED : ", result);
                this.sendResponse(1, result);

            })
    }

    sendResponse(error, result) {

        log.debug("GOT RESPONSE : ", error, result);

        this
            .telemetry
            .trackEvent({
                name: "lambda:request" + (error
                    ? "error"
                    : "success"),
                properties: {
                    domain: this.domain,
                    pid: result.tx.pid,
                    message: result.response
                }
            });

        let compressed = false;
        let canBuffer = this.identity && this.identity.responseConfig && this.identity.responseConfig.type && this
            .identity
            .responseConfig
            .type
            .toLowerCase() == "buffer";
        let canCompress = this.identity && this.identity.responseConfig && this.identity.responseConfig.compress;
        log.debug("RESPONSE CAN BE COMPRESSED "+canCompress+" / BUFFERED "+canBuffer); 
        if (canBuffer && !Buffer.isBuffer(result.response)) {
            if (typeof result.response !== 'string') {
                result.response = canCompress
                    ? pako.deflate(JSON.stringify(result.response), {to: 'string'})
                    : JSON.stringify(result.response);
            } else {
                result.response = canCompress
                    ? pako.deflate(result.reponse, {to: 'string'})
                    : result.response;
            }
            result.response = new Buffer(result.response, "utf8");
            compressed = true;
        }

        let response = {
            error: error
                ? 1
                : 0,
            version: result.tx.version,
            pid: result.tx.pid,
            response: {
                compressed: compressed,
                chunkTotal: 1,
                chunkId: 0,
                data: result.response
            },
            latency: result.tx.latency
        }



        response = this.processLatency(response, 'rx');
        let responseNamespace = this.getResponseNamespace(result.tx.namespace);

        log.debug("FINAL RESPONSE IS : ", response); 


        this.enQueue(responseNamespace, response);

    }

    enQueue(ns, response) {

        this
            .responseQueue
            .push({ns: ns, data: response});
        this.processQueue();

    }

    processQueue() {
        if (this.lambdaBusy) {
            return;
        }
        let response = this
            .responseQueue
            .pop();
        if (response) {
            this.lambdaBusy = true;
            this
                .socket
                .compress(true)
                .emit(response.ns, response.data);
            setTimeout(() => {
                this.lambdaBusy = false;
                this.processQueue();
            }, 100);
        }
    }

    getResponseNamespace(namespace) {

        return (namespace == 'client:tx')
            ? 'client:rx'
            : ((namespace == 'api:tx')
                ? 'api:rx'
                : 'lambda:rx');
    }

    processLambdaResponse(response, name) {

        log.debug("GOT RESPONSE FROM LAMBDA (" + name + ") ", response);

        if (response.kill) {

            log.debug("LAMBDA (" + name + " ON " + response.domain + " ) COMMITTING SUICIDE -> KILLING");
            try {
                this
                    .cache[response.domain][name]
                    .process
                    .kill('SIGINT');

                this.cache[response.domain][name] = false;

            } catch (e) {
                log.error("COULD NOT KILL " + name + " FOR " + response.domain + " : ", e);
            }
            try {
                // delete this.cache[name][index]; this .cache[name] .splice(index, 1);
            } catch (e) {}

            return;
        }
        var that = this;

        //this.cache[name][index].busy = false;
        this
            .telemetry
            .trackEvent({
                name: "lambda.controller.handler.response",
                properties: {
                    domain: response.domain,
                    lambda: name,
                    error: response.error
                        ? true
                        : false
                }
            });

        switch (response.action) {
            case 'rx':
                this.lambdaRx(response, response.namespace);
                break;
            case 'txRequest':
                this.txRequest(response, response.namespace, name);
                break;
            default:
                log.warn("NO EVENT HANDLER FOUND FOR RESPONSE : ", response);
        }

    }

    lambdaEvent(namespace, evt) {

        evt.namespace = namespace;

        let proc = this.getLambdaFromPool(evt, 'events', false);

        log.debug("SENDING TO CACHED EVENTS LAMBDA ");

        try {
            proc
                .process
                .send({action: 'tx', request: evt});
        } catch (e) {
            log.error("COULD NOT SEND TX TO LAMBDA (events) : ", e.stack);
        }
    }

    txRequest(tx, namespace, caller) {

        //console.log("ADD TRANSACTION : ", tx);

        log.debug("CALLER IS " + caller);

        const device = new Device();
        device
            .getDevice()
            .then(deviceData => {

                let payload = {

                    "location": {
                        "lat": 0,
                        "lon": 0
                    },
                    "device": deviceData,
                    "data": tx.data,
                    "pid": tx.pid

                }

                let transaction = {
                    version: this.identity.core[this.environment].version,
                    lambda: tx.lambda,
                    domain: this.domain,
                    environment: this.environment,
                    payload: payload,
                    latency: {
                        transactionSubmitAt: new Date().getTime()
                    }
                }

                this.transactions[tx.pid] = {
                    domain: this.domain,
                    name: caller
                };
                this
                    .socket
                    .emit('lambda:tx', transaction);

            });

    }

    verifyTransaction(obj) {

        return obj.pid
            ? obj
            : false

    }

    processLatency(obj, type) {

        try {
            if (obj) {
                if (type == 'tx') {
                    obj.latency.lambdaReceiveAt = new Date().getTime();
                } else {
                    obj.latency.lambdaResponseAt = new Date().getTime();
                }
            }
        } catch (e) {
            log.error("COULD NOT ADD LATENCY " + type + " TO ", obj);
        }

        return obj;

    }

}

module.exports = Listener;