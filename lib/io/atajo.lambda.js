const path = require('path');
const fs = require('fs');

class Lambda {

    constructor(setup) {

        Object
            .keys(setup)
            .forEach(key => {
                log.debug("LAMBDA: CONFIGURING " + key);
                this[key] = setup[key];
            })

        this.init();

        this.buffer = [];
        this.lambdaCache = {};
        this.txCache = {};

    }

    init() {

        this
            .queue
            .subscribe('LAMBDA:READY');

        this
            .queue
            .subscribe('LAMBDA:RESULT');

        this
            .queue
            .subscribe('LAMBDA:KILL');

        this
            .queue
            .on('message', async(topic, message) => {

                message = JSON.parse(message.toString());
                log.debug("QUEUE MESSAGE (" + topic + ") - ", message);

                switch (topic) {
                    case "LAMBDA:READY":
                        this.onReady(message);
                        break;
                    case "LAMBDA:RESULT":
                        this.lambdaResponse(message);
                        break;
                    case "LAMBDA:KILL":
                        this.kill(message);
                        break;
                }

            })

    }

    onReady(config) {
        log.debug("LAMBDA IS READY : ", config.name, config.domain);
        this.lambdaCache[config.domain][config.name].ready = true;
    }

    onTx(tx) {
        return new Promise((resolve, reject) => {

            let transaction = {
                payload: tx,
                retries: 0,
                promise: {
                    resolve: resolve,
                    reject: reject
                }
            }

            this.process(transaction);

        });

    }

    kill(message) {
        const domain = message.domain;
        const name = message.name;
        log.debug("LAMBDA: KILLING @" + domain + "/" + name);
        const process = this.lambdaCache[domain][name].process;
        process.kill('SIGINT');
        this.lambdaCache[domain][name] = false;

    }

    process(transaction) {

        transaction.retries++;

        try {
            this
                .getLambda(transaction)
                .then(lambda => {

                    if (lambda.error) 
                        transaction.reject(lambda);
                    
                    if (lambda.ready) {
                        log.debug("LAMBDA IS HOT - SENDING TX");
                        this.sendTX(transaction);
                    } else {
                        log.debug("LAMBDA IS COLD - WAITING");
                        if (transaction.retries > 10) {
                            log.warn("LAMBDA: MAXIMUM RETRIES REACHED (DROPPING TRANSACTION) : ", transaction);
                        } else {
                            setTimeout(() => {
                                this.process(transaction)
                            }, 1000);
                        }
                    }

                })
                .catch(error => {
                    log.error("LAMBDA ERROR : ", error);
                })

        } catch (e) {
            log.error("LAMBDA ERROR : " + e);
        }
    }

    async getLambda(transaction) {

        const tx = transaction.payload;
        const domain = tx.domain;
        const name = tx.lambda;

        this.lambdaCache = this.lambdaCache || {};
        this.lambdaCache[domain] = this.lambdaCache[domain] || {};

        return (this.lambdaCache[domain][name] && this.lambdaCache[domain][name].process)
            ? this.lambdaCache[domain][name]
            : false || this.startLambda(domain, name, tx);

    }

    async startLambda(domain, name, tx) {
        return new Promise((resolve, reject) => {

            log.debug("LAMBDA:STARTING - ", domain, name);

            let lambdaFile = path.join(process.cwd(), 'lambdas', name + '.js');
            fs.exists(lambdaFile, (exists) => {

                if (!exists) 
                    resolve(this.error('Lambda not found @' + (tx.destinationDomain || tx.domain) + '/' + name));
                
                log.debug("Starting Lambda " + name + " (" + tx.domain + " on namespace " + tx.namespace + ") @ " + lambdaFile);

                try {

                    let fork = require('child_process').fork;
                    let process = fork(lambdaFile);

                    //REGISTER PROCESS EVENTS
                    process.on('message', (message) => {});
                    process.on('error', (err) => {
                        log.error("LAMBDA ERROR FOR : " + tx.domain + "/" + name + " -> " + err);
                        this
                            .telemetry
                            .trackException({
                                exception: new Error("LAMBDA ERROR FOR : " + tx.domain + "/" + name + " -> " + err)
                            });
                        if ((err + "").indexOf('ERR_IPC_CHANNEL_CLOSED')) {
                            log.info("REMOVING LAMBDA FROM POOL " + tx.domain + "/" + name);
                            process = false;
                        }
                    })

                    process.on('exit', (code, signal) => {
                        // log.warn("LAMBDA EXIT FOR : " + tx.domain + "/" + name + " - CODE : " + code +
                        // " // SIGNAL : " + signal); process = false;
                    })

                    this.lambdaCache[domain][name] = {
                        domain: domain,
                        name: name,
                        process: process,
                        destinationDomain: tx.destinationDomain,
                        secret: this.secret,
                        identity: this.identity,
                        ready: false
                    };

                    //INIT LAMBDA
                    process.send({
                        action: 'init',
                        release: this.release,
                        port: this.queue.port,
                        domain: domain,
                        name: name,
                        destinationDomain: tx.destinationDomain,
                        secret: this.secret,
                        identity: this.identity
                    });

                    resolve(this.lambdaCache[domain][name]);

                } catch (e) {
                    resolve(this.error('LAMBDA: COULD NOT START - ' + (e.stack || e)));
                }

            });

        })

    }

    lambdaResponse(result) {

        log.debug("QUEUE GOT RESPONSE : ", result);

        if (result.pid) {

            let transaction = this.txCache[result.pid] || false;
            if (transaction) {

                let transactionDuration = (new Date().getTime() - transaction.requestStart)

                log.debug("TX DURATION IS : " + transactionDuration + "ms");
                if (result.error) {
                    this
                        .telemetry
                        .trackRequest({
                            name: "GET " + transaction.payload.lambda,
                            url: "@" + transaction.payload.destinationDomain,
                            duration: transactionDuration,
                            resultCode: 200,
                            success: false
                        });
                    transaction
                        .promise
                        .reject({tx: transaction.payload, response: result.response})
                } else {
                    log.debug("RESOLVING 1 : ", transaction.promise);
                    this
                        .telemetry
                        .trackRequest({
                            name: "GET " + transaction.payload.lambda,
                            url: "@" + transaction.payload.destinationDomain,
                            duration: transactionDuration,
                            resultCode: 200,
                            success: true
                        });
                    log.debug("RESOLVING : ", transaction.promise);
                    transaction
                        .promise
                        .resolve({tx: transaction.payload, response: result.response})
                }

                delete this.txCache[result.pid]

            } else {
                log.error("QUEUE COULD NOT FIND PID : ", result.pid);
            }

        } else {
            log.error("QUEUE GOT RESPONSE WITH NO PID : ", result);
        }

    }

    error(message) {
        return {error: 1, message: message};
    }

    sendTX(transaction) {

        const tx = transaction.payload;
        const domain = tx.domain;
        const name = tx.lambda;

        transaction.requestStart = new Date().getTime();

        this.txCache[tx.pid] = transaction;
        const lambda = this.lambdaCache[domain][name];

        log.debug("QUEING TRANSACTION FROM " + tx.domain + " TO " + tx.destinationDomain + " @ " + name, tx);

        this
            .queue
            .publish("tx:" + domain + ":" + name, JSON.stringify(tx));

    }

}

module.exports = Lambda;